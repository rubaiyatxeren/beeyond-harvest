// utils/emailService.js
// Production-safe, non-blocking, fail-tolerant email service

const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let isInitializing = false;
let lastFailureTime = 0;
let consecutiveFailures = 0;

// ✅ Configuration with shorter timeouts
const EMAIL_CONFIG = {
  connectionTimeout: 5000, // 5 seconds max
  greetingTimeout: 5000,
  socketTimeout: 5000,
  maxRetries: 2,
  retryDelay: 1000,
  cooldownPeriod: 60000, // 1 minute cooldown after failures
};

/**
 * Resolve smtp.gmail.com to IPv4 (Render fix)
 */
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

/**
 * Check if email service should be attempted (cooldown logic)
 */
const shouldAttemptEmail = () => {
  if (consecutiveFailures >= 5) {
    const now = Date.now();
    if (now - lastFailureTime < EMAIL_CONFIG.cooldownPeriod) {
      console.log(
        `⏸️ Email in cooldown (${consecutiveFailures} failures). Skipping...`,
      );
      return false;
    } else {
      // Reset after cooldown
      consecutiveFailures = 0;
    }
  }
  return true;
};

/**
 * Initialize transporter (SAFE with shorter timeouts)
 */
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

    // ✅ Use connection pool with limits
    transporter = nodemailer.createTransport({
      host: resolvedHost,
      port,
      secure: port === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        servername: EMAIL_HOST,
        rejectUnauthorized: false, // ✅ Don't reject self-signed certs
        minVersion: "TLSv1.2",
      },
      family: 4,
      connectionTimeout: EMAIL_CONFIG.connectionTimeout,
      greetingTimeout: EMAIL_CONFIG.greetingTimeout,
      socketTimeout: EMAIL_CONFIG.socketTimeout,
      pool: true, // ✅ Use connection pooling
      maxConnections: 3, // ✅ Limit concurrent connections
      maxMessages: 100, // ✅ Recreate after 100 messages
    });

    // ✅ Quick test with timeout (don't let it hang)
    const testPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Verification timeout")), 5000),
    );

    try {
      await Promise.race([testPromise, timeoutPromise]);
      console.log(`✅ Email transporter ready (${resolvedHost}:${port})`);
    } catch (verifyError) {
      console.warn(
        `⚠️ Transporter verification failed: ${verifyError.message}`,
      );
      // Still use transporter - it might work
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

/**
 * Send email with retry logic
 */
const sendEmail = async (to, subject, html, retryCount = 0) => {
  // Check if email should be attempted
  if (!shouldAttemptEmail()) {
    return { success: false, error: "Email in cooldown", skipped: true };
  }

  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled by config");
    return { success: true, disabled: true };
  }

  // Validate email
  if (!to || !subject || !html) {
    console.error("❌ Invalid email parameters");
    return { success: false, error: "Invalid parameters" };
  }

  try {
    // Get or initialize transporter
    let t = transporter;
    if (!t) {
      t = await initTransporter();
    }

    if (!t) {
      console.warn("⚠️ Email transporter unavailable");
      return { success: false, error: "Email service unavailable" };
    }

    const from = `"Beeyond Harvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;

    console.log(`📧 Attempting to send to: ${to} (attempt ${retryCount + 1})`);

    // ✅ Send with timeout
    const sendPromise = t.sendMail({ from, to, subject, html });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Send timeout")),
        EMAIL_CONFIG.socketTimeout,
      ),
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);

    console.log(`✅ Email sent to: ${to}`);

    // Reset failures on success
    consecutiveFailures = 0;
    lastFailureTime = 0;

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(
      `❌ Email failed (attempt ${retryCount + 1}) → ${to}:`,
      err.message,
    );

    // Update failure tracking
    consecutiveFailures++;
    lastFailureTime = Date.now();

    // Reset transporter on certain errors
    const shouldReset = [
      "EAUTH",
      "ECONNECTION",
      "ETIMEDOUT",
      "ESOCKET",
      "ENETUNREACH",
    ].includes(err.code);
    if (shouldReset) {
      console.log("🔄 Resetting transporter due to error type:", err.code);
      transporter = null;
    }

    // Retry logic with exponential backoff
    if (
      retryCount < EMAIL_CONFIG.maxRetries &&
      !err.message.includes("timeout")
    ) {
      const delay = EMAIL_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendEmail(to, subject, html, retryCount + 1);
    }

    return { success: false, error: err.message, code: err.code };
  }
};

/**
 * Non-blocking email sender (fire and forget)
 */
const sendEmailAsync = (to, subject, html) => {
  // Don't await - let it run in background
  sendEmail(to, subject, html).catch((err) => {
    console.error("Background email error:", err.message);
  });
};

/**
 * Send order confirmation with fallback
 */
const sendOrderConfirmation = async (order, customerEmail) => {
  const subject = `Order Confirmed - ${order.orderNumber}`;
  const html = `
    <h1>Thank you for your order!</h1>
    <p>Your order #${order.orderNumber} has been confirmed.</p>
    <p>Total: ${order.totalAmount} BDT</p>
    <p>We'll notify you when your order ships.</p>
  `;

  const result = await sendEmail(customerEmail, subject, html);

  if (!result.success) {
    console.warn(`⚠️ Could not send confirmation to ${customerEmail}`);
    // Store failed email in database for retry later
    await storeFailedEmail(order._id, customerEmail, subject, html);
  }

  return result;
};

/**
 * Store failed emails for retry (optional)
 */
const storeFailedEmail = async (orderId, email, subject, html) => {
  // Implement if you want to retry failed emails later
  console.log(`📝 Storing failed email for order ${orderId}`);
  // You can save to a "failed_emails" collection
};

/**
 * Health check for email service
 */
const checkEmailHealth = async () => {
  const transporter = await initTransporter();
  if (!transporter) {
    return { healthy: false, reason: "No transporter" };
  }

  try {
    const testPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 3000),
    );
    await Promise.race([testPromise, timeoutPromise]);
    return { healthy: true };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
};

module.exports = {
  sendEmail,
  sendEmailAsync,
  sendOrderConfirmation,
  checkEmailHealth,
};
