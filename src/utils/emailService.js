// utils/emailServiceSimple.js
const nodemailer = require("nodemailer");

let transporter = null;

const initTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',  // Use service instead of host/port
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
    console.log("📧 Gmail transporter created");
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
      to: to,
      subject: subject,
      html: html,
    });
    
    console.log(`✅ Email sent: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Email error:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
