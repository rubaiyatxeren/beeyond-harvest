// utils/emailService.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with better error handling
let transporter;

const initTransporter = () => {
  try {
    // ✅ FIX: Use EMAIL_PASS instead of EMAIL_PASSWORD
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS; // ← Fixed: changed from EMAIL_PASSWORD
    const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
    const emailPort = parseInt(process.env.EMAIL_PORT) || 587;

    console.log("📧 Email Config Check:");
    console.log(`   Host: ${emailHost}`);
    console.log(`   Port: ${emailPort}`);
    console.log(`   User: ${emailUser ? "✓ Set" : "✗ Missing"}`);
    console.log(
      `   Pass: ${emailPass ? "✓ Set (length: " + emailPass.length + ")" : "✗ Missing"}`,
    );

    if (!emailUser || !emailPass) {
      console.warn("⚠️ Email credentials missing. Email will be disabled.");
      return;
    }

    transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for 587
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      // Add timeout settings
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    console.log("📧 Email transporter initialized");

    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        console.error("❌ Email verification failed:", error.message);
        console.log("   Check your EMAIL_PASS (App Password)");
      } else {
        console.log("✅ Email server connection successful");
      }
    });
  } catch (error) {
    console.error("❌ Email transporter initialization failed:", error.message);
  }
};

// Initialize on module load
initTransporter();

const sendEmail = async (to, subject, html) => {
  try {
    if (!transporter) {
      console.warn(
        "⚠️ Email transporter not initialized. Skipping email send.",
      );
      return { messageId: "mock-email-id", mock: true, success: false };
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Email credentials not configured. Skipping email send.");
      console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? "✓" : "✗"}`);
      console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? "✓" : "✗"}`);
      return { messageId: "mock-email-id", mock: true, success: false };
    }

    const fromEmail =
      process.env.EMAIL_FROM || `"Beeyond Harvest" <${process.env.EMAIL_USER}>`;

    console.log(`📧 Sending email to: ${to}`);
    console.log(`   Subject: ${subject}`);

    const info = await transporter.sendMail({
      from: fromEmail,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject,
      html: html,
    });

    console.log("✅ Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email error:", error.message);
    // Don't throw error, just return failure
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("⚠️ Email not configured - skipping test");
      console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? "✓" : "✗"}`);
      console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? "✓" : "✗"}`);
      return false;
    }

    if (!transporter) {
      console.log("⚠️ Transporter not initialized");
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
