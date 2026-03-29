// utils/emailService.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with better error handling
let transporter;

const initTransporter = () => {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log("📧 Email transporter initialized");
  } catch (error) {
    console.error("❌ Email transporter initialization failed:", error.message);
  }
};

// Initialize on module load
initTransporter();

const sendEmail = async (to, subject, html) => {
  try {
    if (!transporter) {
      initTransporter();
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn("⚠️ Email credentials not configured. Skipping email send.");
      return { messageId: "mock-email-id", mock: true };
    }

    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
    });
    console.log("✅ Email sent:", info.messageId, "to:", to);
    return info;
  } catch (error) {
    console.error("❌ Email error:", error.message);
    throw error;
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER) {
      console.log("⚠️ Email not configured - skipping test");
      return false;
    }
    await transporter.verify();
    console.log("✅ Email server connection successful");
    return true;
  } catch (error) {
    console.error("❌ Email server connection failed:", error.message);
    return false;
  }
};

module.exports = { sendEmail, testEmailConfig };
