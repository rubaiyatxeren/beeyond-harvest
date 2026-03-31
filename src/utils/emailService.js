// utils/emailService.js
// Production-safe, non-blocking, fail-tolerant email service

const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let isInitializing = false;

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
 * Initialize transporter (SAFE)
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
        rejectUnauthorized: true,
      },
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });

    // ❌ REMOVE verify() in production (causes timeout crashes)
    console.log(`✅ Email transporter ready (${resolvedHost}:${port})`);

    return transporter;
  } catch (err) {
    console.error("❌ Transporter init error:", err.message);
    transporter = null;
    return null; // ✅ DO NOT THROW
  } finally {
    isInitializing = false;
  }
};

/**
 * Send email (SAFE - never crashes app)
 */
const sendEmail = async (to, subject, html) => {
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled");
    return { success: true };
  }

  try {
    let t = transporter || (await initTransporter());

    if (!t) {
      console.warn("⚠️ Email transporter unavailable");
      return { success: false, error: "Email not available" };
    }

    const from = `"Beeyond Harvest 🌾" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;

    console.log(`📧 Sending → ${to}`);
    const info = await t.sendMail({ from, to, subject, html });

    console.log(`✅ Sent → ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed → ${to}:`, err.message);

    // 🔄 Reset on network errors
    if (
      ["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "ENETUNREACH"].includes(
        err.code,
      )
    ) {
      console.log("🔄 Resetting transporter...");
      transporter = null;
    }

    return { success: false, error: err.message };
  }
};

/**
 * Optional test
 */
const testEmailService = async (to) => {
  return sendEmail(
    to || process.env.EMAIL_USER,
    "Test Email",
    `<p>✅ Email working at ${new Date().toLocaleString()}</p>`,
  );
};

module.exports = { sendEmail, testEmailService };
