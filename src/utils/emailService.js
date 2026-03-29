// utils/emailService.js
// Provider: Brevo (formerly Sendinblue) — 300 emails/day free

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  // ONLY use Brevo - no Gmail fallback
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.error("❌ Brevo credentials missing!");
    console.error(
      "   Please set BREVO_USER and BREVO_PASS in environment variables",
    );
    console.error(
      "   Current BREVO_USER:",
      process.env.BREVO_USER ? "✓ Set" : "✗ Missing",
    );
    console.error(
      "   Current BREVO_PASS:",
      process.env.BREVO_PASS ? "✓ Set" : "✗ Missing",
    );
    return null;
  }

  console.log("📧 Configuring Brevo email service...");

  transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // false for port 587
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // Force IPv4 to avoid IPv6 issues
    family: 4,
  });

  // Don't verify immediately - do it async
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Brevo verification failed:", error.message);
      console.error(
        "   Please check your Brevo credentials at: https://app.brevo.com/settings/keys/smtp",
      );
      transporter = null;
    } else {
      console.log("✅ Brevo email service ready - 300 emails/day free tier");
    }
  });

  return transporter;
};

const sendEmail = async (to, subject, html) => {
  // Check if email is disabled
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled by DISABLE_EMAIL flag");
    return { success: true, message: "Email disabled" };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "Email service unavailable - Brevo not configured",
    };
  }

  try {
    const senderEmail = process.env.BREVO_USER;
    const fromEmail = `"Beeyond Harvest 🌾" <${senderEmail}>`;

    console.log(`📧 Sending email to: ${to}`);
    const info = await transporter.sendMail({
      from: fromEmail,
      to: to,
      subject: subject,
      html: html,
    });

    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
