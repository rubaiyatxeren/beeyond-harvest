// utils/emailService.js
// Provider: Brevo (formerly Sendinblue) — 300 emails/day free
// npm install nodemailer

const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.warn("⚠️ BREVO_USER or BREVO_PASS not set");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER, // your Brevo account email
      pass: process.env.BREVO_PASS, // SMTP key from Brevo dashboard (not login password)
    },
  });

  transporter.verify((err) => {
    if (err) {
      console.error("❌ Brevo verify failed:", err.message);
      transporter = null;
    } else {
      console.log("📧 Brevo transporter verified & ready");
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
      error: "Transporter unavailable — check BREVO_USER/BREVO_PASS",
    };

  try {
    console.log(`📧 Sending to: ${to}`);
    const info = await t.sendMail({
      from: `"Beeyond Harvest 🌾" <${process.env.BREVO_USER}>`,
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
