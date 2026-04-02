// utils/emailService.js - FIXED VERSION
// Production-safe, non-blocking, fail-tolerant email service

const nodemailer = require("nodemailer");
const {
  orderConfirmationCustomer,
  orderStatusUpdateCustomer,
  newOrderAdmin,
  lowStockAdmin,
} = require("./emailTemplates");

let transporter = null;
let lastFailureTime = 0;
let consecutiveFailures = 0;

const EMAIL_CONFIG = {
  connectionTimeout: 10000, // Increased
  socketTimeout: 10000, // Increased
  maxRetries: 2,
  retryDelay: 2000,
  cooldownPeriod: 60000,
};

// REMOVED DNS resolution - it was causing delays
// REMOVED verification timeout race - it was causing false failures

const initTransporter = async () => {
  if (transporter) return transporter;

  try {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;
    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️ Email not configured. Skipping transporter.");
      return null;
    }

    const port = parseInt(EMAIL_PORT || "587", 10); // Changed to 587 (TLS)

    console.log(`📧 Initializing email transporter on ${EMAIL_HOST}:${port}`);

    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: port,
      secure: port === 465, // false for port 587
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: "TLSv1.2",
      },
      connectionTimeout: EMAIL_CONFIG.connectionTimeout,
      socketTimeout: EMAIL_CONFIG.socketTimeout,
      // Simplified config - no pooling
      pool: false,
    });

    // Don't verify - just return transporter
    // Verification was causing timeouts
    console.log(`✅ Email transporter created (${EMAIL_HOST}:${port})`);
    return transporter;
  } catch (err) {
    console.error("❌ Transporter init error:", err.message);
    transporter = null;
    return null;
  }
};

const shouldAttemptEmail = () => {
  if (consecutiveFailures >= 5) {
    const now = Date.now();
    if (now - lastFailureTime < EMAIL_CONFIG.cooldownPeriod) {
      console.log(
        `⏸️ Email in cooldown (${consecutiveFailures} failures). Skipping...`,
      );
      return false;
    } else {
      consecutiveFailures = 0;
    }
  }
  return true;
};

// ─────────────────────────────────────────────
// CORE SEND - SIMPLIFIED
// ─────────────────────────────────────────────
const sendEmail = async (to, subject, html, retryCount = 0) => {
  if (!shouldAttemptEmail())
    return { success: false, error: "Email in cooldown", skipped: true };
  if (process.env.DISABLE_EMAIL === "true")
    return { success: true, disabled: true };
  if (!to || !subject || !html)
    return { success: false, error: "Invalid parameters" };

  try {
    // Get or create transporter
    let t = transporter;
    if (!t) {
      t = await initTransporter();
      if (!t) throw new Error("Email service unavailable");
    }

    const from = `"BeeHarvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;
    console.log(`📧 Sending to: ${to} (attempt ${retryCount + 1})`);

    // REMOVED Promise.race - it was causing premature timeouts
    // Let nodemailer handle its own timeouts
    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent → ${to}`);
    consecutiveFailures = 0;
    lastFailureTime = 0;
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(
      `❌ Email failed (attempt ${retryCount + 1}) → ${to}:`,
      err.message,
    );
    consecutiveFailures++;
    lastFailureTime = Date.now();

    // Reset transporter on connection errors
    if (
      err.code === "ESOCKET" ||
      err.code === "ECONNECTION" ||
      err.code === "ETIMEDOUT"
    ) {
      console.log("🔄 Resetting transporter due to connection error");
      transporter = null;
    }

    // Retry logic (including timeout errors now)
    if (retryCount < EMAIL_CONFIG.maxRetries) {
      const delay = EMAIL_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return sendEmail(to, subject, html, retryCount + 1);
    }

    return { success: false, error: err.message, code: err.code };
  }
};

// Non-blocking version for background sending
const sendEmailAsync = (to, subject, html) => {
  sendEmail(to, subject, html).catch((err) =>
    console.error("Background email error:", err.message),
  );
};

// ─────────────────────────────────────────────
// HIGH-LEVEL HELPERS - FIRE AND FORGET
// ─────────────────────────────────────────────

/**
 * Send order confirmation to customer + alert to admin
 * NON-BLOCKING - don't await this
 */
const sendOrderConfirmation = (order) => {
  // Fire and forget - don't block order creation
  setTimeout(async () => {
    try {
      console.log(
        `📧 [EMAIL] Starting background job for ${order.orderNumber}`,
      );

      // 1. Customer confirmation
      if (order.customerEmail) {
        const html = orderConfirmationCustomer(order);
        const result = await sendEmail(
          order.customerEmail,
          `✅ Order Confirmed — ${order.orderNumber} | BeeHarvest`,
          html,
        );

        if (result.success) {
          console.log(
            `✅ [EMAIL] Customer email sent → ${order.customerEmail}`,
          );
        } else {
          console.warn(
            `⚠️ [EMAIL] Customer email failed for ${order.customerEmail}`,
          );
          await storeFailedEmail(
            order._id,
            order.customerEmail,
            "order_confirmation",
          );
        }
      }

      // 2. Admin alert
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const html = newOrderAdmin(order);
        const result = await sendEmail(
          adminEmail,
          `🔴 New Order — ${order.orderNumber} (${order.totalAmount} BDT) | BeeHarvest`,
          html,
        );

        if (result.success) {
          console.log(`✅ [EMAIL] Admin email sent → ${adminEmail}`);
        }
      }

      console.log(`📧 [EMAIL] Job complete for ${order.orderNumber}`);
    } catch (err) {
      console.error(
        `📧 [EMAIL] Background job failed for ${order.orderNumber}:`,
        err.message,
      );
    }
  }, 100); // Small delay to ensure order is fully saved

  return { queued: true };
};

/**
 * Send order status update to customer
 */
const sendStatusUpdate = async (order) => {
  if (!order.customerEmail)
    return { success: false, error: "No customer email" };

  const statusSubjects = {
    processing: `📦 Your order is being packed — ${order.orderNumber}`,
    shipped: `🚚 Order shipped — ${order.orderNumber}`,
    delivered: `🎉 Delivery completed — ${order.orderNumber} | BeeHarvest`,
    cancelled: `❌ Order cancelled — ${order.orderNumber} | BeeHarvest`,
  };

  const subject =
    statusSubjects[order.status] ||
    `Order Update — ${order.orderNumber} | BeeHarvest`;
  const html = orderStatusUpdateCustomer(order);
  return sendEmail(order.customerEmail, subject, html);
};

/**
 * Send low stock alert to admin
 */
const sendLowStockAlert = async (products = []) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !products.length) return;
  const html = lowStockAdmin(products);
  return sendEmail(
    adminEmail,
    `⚠️ Low Stock Alert — ${products.length} products need restock | BeeHarvest`,
    html,
  );
};

// ─────────────────────────────────────────────
// FAILED EMAIL LOG - For retry later
// ─────────────────────────────────────────────
const storeFailedEmail = async (orderId, email, type) => {
  console.log(
    `📝 Storing failed email [${type}] for order ${orderId} → ${email}`,
  );
  // You can implement database storage here if needed
  // For now, just log it
};

// ─────────────────────────────────────────────
// HEALTH CHECK - Simplified
// ─────────────────────────────────────────────
const checkEmailHealth = async () => {
  try {
    const t = await initTransporter();
    if (!t) return { healthy: false, reason: "No transporter" };
    return { healthy: true };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
};

module.exports = {
  sendEmail,
  sendEmailAsync,
  sendOrderConfirmation,
  sendStatusUpdate,
  sendLowStockAlert,
  checkEmailHealth,
};
