// utils/emailService.js
// Provider: Brevo (formerly Sendinblue) — 300 emails/day free

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

let transporter = null;
let isInitialized = false;
let initializationPromise = null;

const initializeTransporter = async () => {
  if (isInitialized && transporter) return transporter;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    console.log("📧 Initializing Brevo email service...");

    // Check credentials
    if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
      const error =
        "❌ Brevo credentials missing! Set BREVO_USER and BREVO_PASS in environment variables";
      console.error(error);
      throw new Error(error);
    }

    try {
      // Create transporter with detailed configuration
      transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.BREVO_USER,
          pass: process.env.BREVO_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        logger: false,
        debug: false,
        // Important: Disable TLS for Brevo
        tls: {
          rejectUnauthorized: false,
        },
      });

      console.log("🔐 Verifying Brevo SMTP connection...");

      // Verify connection with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("SMTP verification timeout (15s)"));
        }, 15000);

        transporter.verify((error, success) => {
          clearTimeout(timeout);
          if (error) {
            console.error("❌ Brevo SMTP verification failed:", error.message);
            reject(error);
          } else {
            console.log("✅ Brevo SMTP connection verified successfully");
            resolve(success);
          }
        });
      });

      isInitialized = true;
      console.log("🚀 Brevo email service ready - 300 emails/day free tier");
      return transporter;
    } catch (error) {
      console.error(
        "❌ Failed to initialize Brevo email service:",
        error.message,
      );
      console.log("\n🔧 Troubleshooting tips:");
      console.log(
        "1. Check Brevo SMTP credentials at: https://app.brevo.com/settings/keys/smtp",
      );
      console.log("2. Verify your sender email is confirmed in Brevo");
      console.log("3. Check if port 587 is blocked by your hosting provider");
      console.log("4. Try using Brevo API instead of SMTP if issues persist");

      transporter = null;
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
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
    // Ensure transporter is initialized
    if (!transporter || !isInitialized) {
      console.log("🔄 Initializing email transporter...");
      await initializeTransporter();
    }

    const senderEmail = process.env.BREVO_USER;
    const fromEmail = `"Beeyond Harvest 🌾" <${senderEmail}>`;

    console.log(`📧 Attempting to send email to: ${to}`);

    const mailOptions = {
      from: fromEmail,
      to: to,
      subject: subject,
      html: html,
      // Add headers for better deliverability
      headers: {
        "X-Mailer": "Beeyond Harvest",
        "X-Priority": "3",
      },
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);

    // Reset on specific errors to force re-initialization
    if (
      error.code === "EAUTH" ||
      error.code === "ECONNECTION" ||
      error.code === "ETIMEDOUT"
    ) {
      console.log("🔄 Resetting transporter due to connection error...");
      transporter = null;
      isInitialized = false;
      initializationPromise = null;
    }

    return {
      success: false,
      error: error.message,
      code: error.code,
      details: "Check Brevo SMTP configuration",
    };
  }
};

// Test function with detailed diagnostics
const testEmailService = async (testEmail = null) => {
  console.log("🧪 Starting comprehensive email service test...");

  // Check environment variables
  console.log("🔍 Checking environment variables...");
  if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
    console.error("❌ Missing BREVO_USER or BREVO_PASS environment variables");
    console.log("💡 Set them in your .env file:");
    console.log("   BREVO_USER=your-smtp-login@brevo.com");
    console.log("   BREVO_PASS=your-smtp-password");
    return false;
  }

  console.log("✅ Environment variables found");
  console.log(`   BREVO_USER: ${process.env.BREVO_USER.substring(0, 5)}...`);
  console.log(`   BREVO_PASS: ${process.env.BREVO_PASS.substring(0, 5)}...`);

  try {
    const testTo = testEmail || process.env.BREVO_USER;
    console.log(`📧 Test email will be sent to: ${testTo}`);

    const testResult = await sendEmail(
      testTo,
      "🧪 Beeyond Harvest - Email Service Test",
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✅ Email Service Test</h2>
        <p>If you're reading this, your Beeyond Harvest email service is working correctly!</p>
        <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Sender:</strong> ${process.env.BREVO_USER}</p>
        <p><strong>Recipient:</strong> ${testTo}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated test from your application.
        </p>
      </div>
      `,
    );

    if (testResult.success) {
      console.log("🎉 Email service test PASSED!");
      console.log("   Email should arrive in the recipient's inbox shortly");
      return true;
    } else {
      console.error("❌ Email service test FAILED");
      console.error("   Error:", testResult.error);
      if (testResult.details) {
        console.error("   Details:", testResult.details);
      }
      return false;
    }
  } catch (error) {
    console.error("💥 Test crashed:", error.message);
    return false;
  }
};

// Initialize on require (optional)
console.log("📧 Email service module loaded");
if (process.env.BREVO_USER && process.env.BREVO_PASS) {
  console.log(
    "🔧 Email credentials detected - transporter will initialize on first use",
  );
}

module.exports = { sendEmail, testEmailService, initializeTransporter };
