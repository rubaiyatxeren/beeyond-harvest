// utils/emailService.js
// Production-safe, non-blocking, fail-tolerant email service

const nodemailer = require("nodemailer");
const dns = require("dns").promises;
const {
  orderConfirmationCustomer,
  orderStatusUpdateCustomer,
  newOrderAdmin,
  lowStockAdmin,
} = require("./emailTemplates");

let transporter = null;
let isInitializing = false;
let lastFailureTime = 0;
let consecutiveFailures = 0;

const EMAIL_CONFIG = {
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
  maxRetries: 2,
  retryDelay: 1000,
  cooldownPeriod: 60000,
};

const resolveIPv4 = async (hostname) => {
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses?.length) {
      console.log(`🔍 Resolved ${hostname} → ${addresses[0]} (IPv4)`);
      return addresses[0];
    }
  } catch (err) {
    console.warn(`⚠️ DNS resolve failed for ${hostname}:`, err.message);
  }
  return hostname;
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

const initTransporter = async () => {
  if (transporter) return transporter;
  if (isInitializing) return null;
  isInitializing = true;

  try {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;
    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️ Email not configured. Skipping transporter.");
      return null;
    }

    const port = parseInt(EMAIL_PORT || "465", 10);
    const resolvedHost = await resolveIPv4(EMAIL_HOST);

    transporter = nodemailer.createTransport({
      host: resolvedHost,
      port,
      secure: port === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      tls: {
        servername: EMAIL_HOST,
        rejectUnauthorized: false,
        minVersion: "TLSv1.2",
      },
      family: 4,
      connectionTimeout: EMAIL_CONFIG.connectionTimeout,
      greetingTimeout: EMAIL_CONFIG.greetingTimeout,
      socketTimeout: EMAIL_CONFIG.socketTimeout,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });

    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_, r) =>
          setTimeout(() => r(new Error("Verification timeout")), 5000),
        ),
      ]);
      console.log(`✅ Email transporter ready (${resolvedHost}:${port})`);
    } catch (verifyError) {
      console.warn(
        `⚠️ Transporter verification failed: ${verifyError.message}`,
      );
    }

    return transporter;
  } catch (err) {
    console.error("❌ Transporter init error:", err.message);
    transporter = null;
    return null;
  } finally {
    isInitializing = false;
  }
};

// ─────────────────────────────────────────────
// CORE SEND
// ─────────────────────────────────────────────
const sendEmail = async (to, subject, html, retryCount = 0) => {
  if (!shouldAttemptEmail())
    return { success: false, error: "Email in cooldown", skipped: true };
  if (process.env.DISABLE_EMAIL === "true")
    return { success: true, disabled: true };
  if (!to || !subject || !html)
    return { success: false, error: "Invalid parameters" };

  try {
    let t = transporter || (await initTransporter());
    if (!t) return { success: false, error: "Email service unavailable" };

    const from = `"BeeHarvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;
    console.log(`📧 Sending to: ${to} (attempt ${retryCount + 1})`);

    const info = await Promise.race([
      t.sendMail({ from, to, subject, html }),
      new Promise((_, r) =>
        setTimeout(
          () => r(new Error("Send timeout")),
          EMAIL_CONFIG.socketTimeout,
        ),
      ),
    ]);

    console.log(`✅ Email sent → ${to} [${info.messageId}]`);
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

    const shouldReset = [
      "EAUTH",
      "ECONNECTION",
      "ETIMEDOUT",
      "ESOCKET",
      "ENETUNREACH",
    ].includes(err.code);
    if (shouldReset) {
      console.log("🔄 Resetting transporter:", err.code);
      transporter = null;
    }

    if (
      retryCount < EMAIL_CONFIG.maxRetries &&
      !err.message.includes("timeout")
    ) {
      const delay = EMAIL_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return sendEmail(to, subject, html, retryCount + 1);
    }

    return { success: false, error: err.message, code: err.code };
  }
};

const sendEmailAsync = (to, subject, html) => {
  sendEmail(to, subject, html).catch((err) =>
    console.error("Background email error:", err.message),
  );
};

// ─────────────────────────────────────────────
// HIGH-LEVEL HELPERS
// ─────────────────────────────────────────────

/**
 * Send order confirmation to customer + alert to admin
 * Call this after a new order is created.
 */
const sendOrderConfirmation = async (order) => {
  const results = {};

  // 1. Customer confirmation
  if (order.customerEmail) {
    const html = orderConfirmationCustomer(order);
    results.customer = await sendEmail(
      order.customerEmail,
      `✅ অর্ডার নিশ্চিত — ${order.orderNumber} | BeeHarvest`,
      html,
    );
    if (!results.customer.success) {
      console.warn(`⚠️ Customer email failed for ${order.customerEmail}`);
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
    results.admin = await sendEmail(
      adminEmail,
      `🔴 নতুন অর্ডার — ${order.orderNumber} (${order.totalAmount} BDT) | BeeHarvest`,
      html,
    );
  }

  return results;
};

/**
 * Send order status update to customer
 * Call this when order status changes.
 */
const sendStatusUpdate = async (order) => {
  if (!order.customerEmail)
    return { success: false, error: "No customer email" };

  const statusSubjects = {
    processing: `📦 আপনার অর্ডার প্যাক হচ্ছে — ${order.orderNumber}`,
    shipped: `🚚 অর্ডার পাঠানো হয়েছে — ${order.orderNumber}`,
    delivered: `🎉 ডেলিভারি সম্পন্ন — ${order.orderNumber} | BeeHarvest`,
    cancelled: `❌ অর্ডার বাতিল — ${order.orderNumber} | BeeHarvest`,
  };

  const subject =
    statusSubjects[order.status] ||
    `অর্ডার আপডেট — ${order.orderNumber} | BeeHarvest`;
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
    `⚠️ স্টক সতর্কতা — ${products.length}টি পণ্যের স্টক কম | BeeHarvest`,
    html,
  );
};

// ─────────────────────────────────────────────
// FAILED EMAIL LOG
// ─────────────────────────────────────────────
const storeFailedEmail = async (orderId, email, type) => {
  console.log(
    `📝 Storing failed email [${type}] for order ${orderId} → ${email}`,
  );
  // TODO: save to FailedEmail collection for retry job
};

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
const checkEmailHealth = async () => {
  const t = await initTransporter();
  if (!t) return { healthy: false, reason: "No transporter" };
  try {
    await Promise.race([
      t.verify(),
      new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 3000)),
    ]);
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
