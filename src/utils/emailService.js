// utils/emailService.js - FINAL FIXED VERSION
const nodemailer = require("nodemailer");
const {
  orderConfirmationCustomer,
  orderStatusUpdateCustomer,
  newOrderAdmin,
  lowStockAdmin,
} = require("./emailTemplates");

let transporter = null;
let consecutiveFailures = 0;
let lastFailureTime = 0;

const EMAIL_CONFIG = {
  connectionTimeout: 15000, // Increased
  socketTimeout: 15000, // Increased
  maxRetries: 2,
  retryDelay: 2000,
  cooldownPeriod: 60000,
};

const initTransporter = async () => {
  if (transporter) return transporter;

  try {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;
    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️ Email not configured");
      return null;
    }

    // FORCE port 587 for Gmail - this is critical
    let port = parseInt(EMAIL_PORT || "587", 10);
    let secure = false; // false for port 587

    // Override for Gmail to ensure correct settings
    if (EMAIL_HOST === "smtp.gmail.com") {
      port = 587;
      secure = false;
      console.log("📧 Using Gmail settings: port 587, TLS");
    }

    console.log(`📧 Initializing email transporter on ${EMAIL_HOST}:${port}`);

    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: port,
      secure: secure, // false for 587, true for 465
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
      debug: false, // Set to true for debugging
    });

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
      console.log(`⏸️ Email in cooldown (${consecutiveFailures} failures)`);
      return false;
    }
    consecutiveFailures = 0;
  }
  return true;
};

const sendEmail = async (to, subject, html, retryCount = 0) => {
  if (!shouldAttemptEmail())
    return { success: false, error: "In cooldown", skipped: true };
  if (process.env.DISABLE_EMAIL === "true")
    return { success: true, disabled: true };
  if (!to || !subject || !html)
    return { success: false, error: "Invalid parameters" };

  try {
    let t = transporter;
    if (!t) {
      t = await initTransporter();
      if (!t) throw new Error("No transporter available");
    }

    const from = `"BeeHarvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;
    console.log(`📧 Sending to: ${to} (attempt ${retryCount + 1})`);

    const info = await t.sendMail({ from, to, subject, html });

    console.log(`✅ Email sent to: ${to}`);
    consecutiveFailures = 0;
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed (attempt ${retryCount + 1}):`, err.message);
    consecutiveFailures++;
    lastFailureTime = Date.now();
    transporter = null; // Reset on any error

    if (retryCount < EMAIL_CONFIG.maxRetries) {
      const delay = EMAIL_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return sendEmail(to, subject, html, retryCount + 1);
    }

    return { success: false, error: err.message };
  }
};

// FIRE AND FORGET - DON'T BLOCK
const sendOrderConfirmation = (order) => {
  setTimeout(async () => {
    try {
      console.log(`📧 [EMAIL] Processing order ${order.orderNumber}`);

      if (order.customerEmail) {
        const html = orderConfirmationCustomer(order);
        await sendEmail(
          order.customerEmail,
          `✅ Order Confirmed — ${order.orderNumber} | BeeHarvest`,
          html,
        );
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const html = newOrderAdmin(order);
        await sendEmail(
          adminEmail,
          `🔴 New Order — ${order.orderNumber} | BeeHarvest`,
          html,
        );
      }

      console.log(`📧 [EMAIL] Complete for ${order.orderNumber}`);
    } catch (err) {
      console.error(`📧 [EMAIL] Failed for ${order.orderNumber}:`, err.message);
    }
  }, 100);

  return { queued: true };
};

const sendStatusUpdate = async (order) => {
  if (!order.customerEmail) return { success: false };

  const subjects = {
    processing: `📦 Order being packed — ${order.orderNumber}`,
    shipped: `🚚 Order shipped — ${order.orderNumber}`,
    delivered: `🎉 Order delivered — ${order.orderNumber}`,
    cancelled: `❌ Order cancelled — ${order.orderNumber}`,
  };

  const subject =
    subjects[order.status] || `Order Update — ${order.orderNumber}`;
  const html = orderStatusUpdateCustomer(order);
  return sendEmail(order.customerEmail, subject, html);
};

const sendLowStockAlert = async (products = []) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !products.length) return;
  const html = lowStockAdmin(products);
  return sendEmail(adminEmail, `⚠️ Low Stock Alert | BeeHarvest`, html);
};

const storeFailedEmail = async (orderId, email, type) => {
  console.log(`📝 Failed email [${type}] for order ${orderId} → ${email}`);
};

const checkEmailHealth = async () => {
  try {
    const t = await initTransporter();
    return { healthy: !!t };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
};

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendStatusUpdate,
  sendLowStockAlert,
  checkEmailHealth,
};
