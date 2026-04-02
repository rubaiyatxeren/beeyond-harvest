// utils/emailService.js
// Fully optimized, non-blocking, Render-safe email service

const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let initializing = false;

let failureCount = 0;
let lastFailureTime = 0;

const CONFIG = {
  maxRetries: 2,
  retryDelay: 1500,
  cooldownMs: 60000,
  timeout: 4000,
  maxFailuresBeforeCooldown: 5,
};

/**
 * Resolve Gmail SMTP to IPv4 (Render fix)
 */
const resolveIPv4 = async (host) => {
  try {
    const ips = await dns.resolve4(host);
    return ips?.[0] || host;
  } catch {
    return host;
  }
};

/**
 * Cooldown system
 */
const isInCooldown = () => {
  if (failureCount < CONFIG.maxFailuresBeforeCooldown) return false;

  const now = Date.now();
  if (now - lastFailureTime < CONFIG.cooldownMs) {
    console.log("⏸️ Email cooldown active");
    return true;
  }

  failureCount = 0;
  return false;
};

/**
 * Initialize transporter (safe + fast)
 */
const getTransporter = async () => {
  if (transporter) return transporter;
  if (initializing) return null;

  initializing = true;

  try {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️ Email config missing");
      return null;
    }

    const host = await resolveIPv4(EMAIL_HOST);

    transporter = nodemailer.createTransport({
      host,
      port: parseInt(EMAIL_PORT || "465", 10),
      secure: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: CONFIG.timeout,
      socketTimeout: CONFIG.timeout,
    });

    console.log("✅ Transporter created");

    return transporter;
  } catch (err) {
    console.error("❌ Transporter error:", err.message);
    transporter = null;
    return null;
  } finally {
    initializing = false;
  }
};

/**
 * Send email (core function)
 */
const sendEmail = async (to, subject, html, retry = 0) => {
  if (process.env.DISABLE_EMAIL === "true") {
    return { success: true, disabled: true };
  }

  if (isInCooldown()) {
    return { success: false, error: "Cooldown active" };
  }

  if (!to || !subject || !html) {
    return { success: false, error: "Invalid email data" };
  }

  try {
    const t = (await getTransporter()) || (await getTransporter());

    if (!t) {
      return { success: false, error: "Transporter unavailable" };
    }

    console.log(`📧 Sending to ${to} (attempt ${retry + 1})`);

    const sendPromise = t.sendMail({
      from: `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Send timeout")), CONFIG.timeout),
    );

    const info = await Promise.race([sendPromise, timeout]);

    console.log("✅ Email sent:", info.messageId);

    failureCount = 0;
    return { success: true };
  } catch (err) {
    console.error("❌ Email error:", err.message);

    failureCount++;
    lastFailureTime = Date.now();

    // reset transporter on network/auth issues
    if (["ECONNECTION", "ETIMEDOUT", "EAUTH", "ESOCKET"].includes(err.code)) {
      transporter = null;
    }

    // retry (only for non-timeout errors)
    if (retry < CONFIG.maxRetries && !err.message.includes("timeout")) {
      await new Promise((r) => setTimeout(r, CONFIG.retryDelay * (retry + 1)));
      return sendEmail(to, subject, html, retry + 1);
    }

    return { success: false, error: err.message };
  }
};

/**
 * NON-BLOCKING (IMPORTANT for Render stability)
 */
const sendEmailAsync = (to, subject, html) => {
  sendEmail(to, subject, html).catch((err) =>
    console.error("Async email error:", err.message),
  );
};

/**
 * Order email helper
 */
const sendOrderConfirmation = async (order, email) => {
  const subject = `Order Confirmed - ${order.orderNumber}`;

  const html = `
    <h2>Order Confirmed</h2>
    <p>Order: ${order.orderNumber}</p>
    <p>Total: ${order.totalAmount} BDT</p>
  `;

  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendEmailAsync,
  sendOrderConfirmation,
};
