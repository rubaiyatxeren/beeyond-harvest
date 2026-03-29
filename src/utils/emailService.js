// utils/emailService.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const dns = require("dns");

let transporter = null;

const initTransporter = () => {
  if (!transporter) {
    // 🔥 FORCE IPv4 (fix for Render ENETUNREACH error)
    dns.setDefaultResultOrder("ipv4first");

    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", // ✅ Use host instead of service
      port: 587,
      secure: false, // TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // ⚠️ Must be Gmail App Password
      },

      // 🔥 Force IPv4
      family: 4,

      // Stability configs
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    console.log("📧 Gmail transporter created (IPv4 forced)");
  }
  return transporter;
};

const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Email not configured");
      return { success: false, error: "No credentials" };
    }

    const transporter = initTransporter();

    console.log(`📧 Sending email to: ${to}`);

    const info = await transporter.sendMail({
      from: `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email error:", error.message);

    // Extra debug logs (helpful in production)
    if (error.code) console.error("Error code:", error.code);
    if (error.command) console.error("Error command:", error.command);

    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
