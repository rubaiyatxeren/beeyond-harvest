// utils/emailService.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const dns = require("dns");

let transporter = null;

const initTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,

      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },

      // 🔥 HARD FORCE IPv4 (THIS IS THE REAL FIX)
      lookup: (hostname, options, callback) => {
        return dns.lookup(hostname, { family: 4 }, callback);
      },

      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    console.log("📧 Gmail transporter created (FORCED IPv4 LOOKUP)");
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
    return { success: true };
  } catch (error) {
    console.error("❌ Email error:", error.message);
    console.error("Code:", error.code);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
