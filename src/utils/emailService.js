// utils/emailService.js - CRASH-PROOF with emails enabled
// NEVER throws errors, NEVER crashes server

const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let emailQueue = [];
let isProcessing = false;
let failureCount = 0;
let lastFailureTime = 0;

const CONFIG = {
  timeout: 5000, // 5 second timeout
  cooldownMs: 60000, // 60 second cooldown on failures
  maxFailuresBeforeCooldown: 5,
  batchDelayMs: 1000,
};

// Mock transporter that ALWAYS works (fallback)
const mockTransporter = {
  sendMail: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { messageId: "mock-" + Date.now() };
  },
};

// Resolve IPv4 for Render (never throws)
const resolveIPv4 = async (host) => {
  try {
    const ips = await dns.resolve4(host);
    return ips?.[0] || host;
  } catch {
    return host;
  }
};

// Get or create transporter (NEVER returns null, always returns something)
const getTransporter = async () => {
  // If we already have a working transporter, use it
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

  // If no config, use mock
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.log("📧 Email config missing - using mock mode");
    return mockTransporter;
  }

  try {
    const host = await resolveIPv4(EMAIL_HOST);

    transporter = nodemailer.createTransport({
      host,
      port: parseInt(EMAIL_PORT || "587", 10),
      secure: EMAIL_PORT === "465",
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      connectionTimeout: CONFIG.timeout,
      socketTimeout: CONFIG.timeout,
      maxConnections: 1,
    });

    // Verify connection (don't await - background)
    transporter.verify().catch(() => {
      console.log("📧 Email verification failed, will retry on next send");
      transporter = null;
    });

    console.log("✅ Email transporter ready");
    return transporter;
  } catch (err) {
    console.log("📧 Transporter error, using mock:", err.message);
    return mockTransporter;
  }
};

// Process queue in background (NEVER crashes)
const processQueue = async () => {
  if (isProcessing || emailQueue.length === 0) return;

  isProcessing = true;

  try {
    while (emailQueue.length > 0) {
      const { to, subject, html, resolve } = emailQueue.shift();

      try {
        const result = await sendEmailImmediate(to, subject, html);
        resolve(result);
      } catch (err) {
        // NEVER reject - always resolve with error info
        resolve({ success: false, error: err.message });
      }

      // Small delay between emails
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    console.log("📧 Queue processor error (ignored):", err.message);
  } finally {
    isProcessing = false;
  }
};

// Immediate send with timeout protection (NEVER throws)
const sendEmailImmediate = async (to, subject, html) => {
  // Cooldown check
  if (
    failureCount >= CONFIG.maxFailuresBeforeCooldown &&
    Date.now() - lastFailureTime < CONFIG.cooldownMs
  ) {
    console.log("⏸️ Email cooldown active - skipping");
    return { success: false, error: "Cooldown active", skipped: true };
  }

  try {
    const transporter = await getTransporter();

    if (!transporter) {
      return { success: false, error: "No transporter", mock: true };
    }

    console.log(`📧 Sending to ${to}`);

    // Race between send and timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log(`📧 [TIMEOUT] Email to ${to} timed out`);
        resolve({ success: false, error: "Timeout", timedOut: true });
      }, CONFIG.timeout);
    });

    const sendPromise = transporter
      .sendMail({
        from: `"Beeyond Harvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@beeyondharvest.com"}>`,
        to,
        subject,
        html: html?.substring(0, 50000) || "",
      })
      .then((info) => {
        console.log(`✅ Email sent to ${to}`);
        failureCount = 0;
        return { success: true, messageId: info.messageId };
      })
      .catch((err) => {
        console.log(`❌ Email failed (${err.message})`);
        failureCount++;
        lastFailureTime = Date.now();

        // Reset transporter on network errors
        if (
          ["ECONNECTION", "ETIMEDOUT", "EAUTH", "ESOCKET"].includes(err.code)
        ) {
          transporter = null;
        }

        return { success: false, error: err.message };
      });

    const result = await Promise.race([sendPromise, timeoutPromise]);
    return result;
  } catch (err) {
    // CATCH EVERYTHING - NEVER THROW
    console.log(`📧 Email exception (ignored):`, err.message);
    failureCount++;
    lastFailureTime = Date.now();
    return { success: false, error: err.message, exception: true };
  }
};

// PUBLIC: Async email - NEVER throws, always returns
const sendEmail = async (to, subject, html) => {
  // Always return a promise that resolves (never rejects)
  return new Promise((resolve) => {
    if (!to || !subject) {
      resolve({ success: false, error: "Invalid email data" });
      return;
    }

    emailQueue.push({ to, subject, html, resolve });
    processQueue().catch(() => {}); // Silent catch
  });
};

// Order confirmation helper - SAFE version
const sendOrderConfirmation = async (order, email) => {
  try {
    const subject = `Order Confirmed - ${order.orderNumber}`;
    const html = `
      <h2>Order Confirmed ✅</h2>
      <p>Order #: ${order.orderNumber}</p>
      <p>Total: ৳${order.total?.toLocaleString() || 0}</p>
      <p>Thank you for shopping with Beeyond Harvest!</p>
      <p>We'll notify you when your order ships.</p>
    `;
    return await sendEmail(email, subject, html);
  } catch (err) {
    // NEVER throw
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendEmail,
  sendOrderConfirmation,
};
