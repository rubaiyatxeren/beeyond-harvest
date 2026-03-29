// utils/emailService.js
// Supports both Gmail and Brevo - automatically detects which to use

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  let config = null;
  
  // Try Brevo first (recommended - free tier)
  if (process.env.BREVO_USER && process.env.BREVO_PASS) {
    console.log("📧 Configuring Brevo email service...");
    config = {
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
    };
  } 
  // Fallback to Gmail
  else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log("📧 Configuring Gmail email service...");
    config = {
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };
  } 
  else {
    console.error("❌ Email not configured: No valid credentials found");
    console.log("📧 Please set either:");
    console.log("   - BREVO_USER and BREVO_PASS (recommended for free tier)");
    console.log("   - EMAIL_USER and EMAIL_PASS (for Gmail)");
    return null;
  }

  transporter = nodemailer.createTransport({
    ...config,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Email transporter verification failed:", error.message);
      transporter = null;
    } else {
      console.log("✅ Email transporter ready - You can send emails now");
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
    return { success: false, error: "Email transporter not available - check credentials" };
  }

  // Determine sender email
  let senderEmail = process.env.BREVO_USER || process.env.EMAIL_USER;
  let fromEmail = `"Beeyond Harvest 🌾" <${senderEmail}>`;

  try {
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
