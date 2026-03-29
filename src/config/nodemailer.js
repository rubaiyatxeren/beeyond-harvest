// utils/emailService.js
// Provider: Brevo (formerly Sendinblue) — 300 emails/day free
// npm install nodemailer dotenv

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with better error handling
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  // Check if email credentials are configured (using BREVO credentials)
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.error("❌ Email not configured: Missing BREVO_USER or BREVO_PASS");
    console.log("📧 Please set BREVO_USER and BREVO_PASS in your environment variables");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",  // Brevo SMTP server
    port: 587,
    secure: false,  // false for port 587
    auth: {
      user: process.env.BREVO_USER,  // Your Brevo email/SMTP login
      pass: process.env.BREVO_PASS,  // Your Brevo SMTP key
    },
    // Add timeout and retry settings
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify connection on startup
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Email transporter verification failed:", error.message);
      console.log("📧 Email service will not work. Check your Brevo credentials.");
      transporter = null;
    } else {
      console.log("✅ Brevo email transporter ready - You can send 300 emails/day free");
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

  // Check if email is configured (using BREVO credentials)
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.error("❌ Email not configured. Set BREVO_USER and BREVO_PASS in environment.");
    return { success: false, error: "Email not configured - missing Brevo credentials" };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: "Email transporter not available" };
  }

  try {
    // Use Brevo email as the sender
    const fromEmail = `"Beeyond Harvest 🌾" <${process.env.BREVO_USER}>`;

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
