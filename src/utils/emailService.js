// utils/emailService.js
// Provider: Brevo (formerly Sendinblue) — 300 emails/day free

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

let transporter = null;
let isTransporterReady = false;
let transporterError = null;

const initializeTransporter = async () => {
  if (isTransporterReady && transporter) return transporter;

  // Reset state
  isTransporterReady = false;
  transporterError = null;

  // ONLY use Brevo - no Gmail fallback
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    transporterError =
      "Brevo credentials missing! Please set BREVO_USER and BREVO_PASS in environment variables";
    console.error("❌ " + transporterError);
    return null;
  }

  console.log("📧 Configuring Brevo email service...");

  try {
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

    // Verify synchronously
    await transporter.verify();
    console.log("✅ Brevo email service ready - 300 emails/day free tier");
    isTransporterReady = true;
    return transporter;
  } catch (error) {
    transporterError = error.message;
    console.error("❌ Brevo verification failed:", error.message);
    console.error(
      "   Please check your Brevo credentials at: https://app.brevo.com/settings/keys/smtp",
    );
    transporter = null;
    return null;
  }
};

const sendEmail = async (to, subject, html) => {
  // Check if email is disabled
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled by DISABLE_EMAIL flag");
    return { success: true, message: "Email disabled" };
  }

  // Check credentials first
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    const errorMsg = "Email service unavailable - Brevo credentials missing";
    console.error("❌ " + errorMsg);
    return {
      success: false,
      error: errorMsg,
      details: "Set BREVO_USER and BREVO_PASS environment variables",
    };
  }

  try {
    // Initialize transporter if not ready
    if (!isTransporterReady || !transporter) {
      const emailTransporter = await initializeTransporter();
      if (!emailTransporter) {
        return {
          success: false,
          error: "Email service unavailable - Failed to initialize transporter",
          details: transporterError,
        };
      }
    }

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
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);

    // Reset transporter on error to force re-initialization
    if (error.code === "EAUTH" || error.code === "ECONNECTION") {
      isTransporterReady = false;
      transporter = null;
    }

    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};

// Test function to verify email service
const testEmailService = async (testEmail = null) => {
  console.log("🧪 Testing email service...");

  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.error("❌ Test failed: Missing Brevo credentials");
    return false;
  }

  const testTo = testEmail || process.env.BREVO_USER;
  const testResult = await sendEmail(
    testTo,
    "📧 Beeyond Harvest - Email Service Test",
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">✅ Email Service Test Successful!</h2>
      <p>Your Beeyond Harvest email service is working correctly.</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Sender:</strong> ${process.env.BREVO_USER}</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        This is an automated test email from your Beeyond Harvest application.
      </p>
    </div>
    `,
  );

  if (testResult.success) {
    console.log("✅ Email service test PASSED");
  } else {
    console.error("❌ Email service test FAILED:", testResult.error);
  }

  return testResult.success;
};

module.exports = { sendEmail, testEmailService, initializeTransporter };
