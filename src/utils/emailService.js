// utils/emailService.js
const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set");
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail", // works on both local & Render (IPv4-safe)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // 16-char App Password
    },
    pool: true,
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 3,
  });

  // Verify on startup so you know immediately if creds are wrong
  transporter.verify((err) => {
    if (err) {
      console.error("❌ Email verify failed:", err.message);
      transporter = null; // reset so next call retries
    } else {
      console.log("📧 Gmail transporter verified & ready");
    }
  });

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
    console.log(`📧 Sending to: ${to}`);
    const info = await t.sendMail({
      from: `"Beeyond Harvest 🌾" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `❌ Email failed to ${to}:`,
      error.message,
      "| Code:",
      error.code,
    );
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
