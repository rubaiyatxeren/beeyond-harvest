// utils/emailService.js
const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set");
    return null;
  }

  // ✅ Use `service: "gmail"` — Nodemailer resolves Gmail SMTP with
  // IPv4-only internally, bypassing Render's broken IPv6 routing.
  // Do NOT use host/port manually — that's what causes ENETUNREACH.
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App Password (not Gmail login password)
    },
    pool: true, // reuse connections — avoids repeated handshake timeouts
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 3,
  });

  console.log("📧 Gmail transporter ready (service mode)");
  return transporter;
};

const sendEmail = async (to, subject, html) => {
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email skipped (DISABLE_EMAIL=true)");
    return { success: true };
  }

  const t = getTransporter();
  if (!t)
    return {
      success: false,
      error: "Transporter unavailable — check EMAIL_USER/EMAIL_PASS",
    };

  try {
    console.log(`📧 Sending email to: ${to}`);
    const info = await t.sendMail({
      // ✅ from address MUST be the authenticated Gmail account
      from: `"Beeyond Harvest 🌾" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    console.error("Code:", error.code);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
