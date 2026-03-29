// utils/emailService.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with better error handling
let transporter;

const initTransporter = () => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
    const emailPort = parseInt(process.env.EMAIL_PORT) || 587;
    
    console.log("📧 Email Config Check:");
    console.log(`   Host: ${emailHost}`);
    console.log(`   Port: ${emailPort}`);
    console.log(`   User: ${emailUser ? "✓ Set" : "✗ Missing"}`);
    console.log(`   Pass: ${emailPass ? "✓ Set (length: " + emailPass.length + ")" : "✗ Missing"}`);
    
    if (!emailUser || !emailPass) {
      console.warn("⚠️ Email credentials missing. Email will be disabled.");
      return;
    }
    
    // ✅ FIX: Force IPv4 by using the IP address instead of hostname
    // Gmail's IPv4 address for smtp.gmail.com
    const ipv4Address = "142.250.185.109"; // smtp.gmail.com IPv4
    
    transporter = nodemailer.createTransport({
      host: ipv4Address, // Use IPv4 address instead of hostname
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // ✅ Additional options to force IPv4
      family: 4, // Force IPv4
      tls: {
        rejectUnauthorized: false,
        // Force TLS
        ciphers: "SSLv3",
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // ✅ Disable IPv6
      localAddress: "0.0.0.0",
    });
    
    console.log("📧 Email transporter initialized (IPv4 forced)");
    
    // Verify connection
    setTimeout(() => {
      if (transporter) {
        transporter.verify((error, success) => {
          if (error) {
            console.error("❌ Email verification failed:", error.message);
          } else {
            console.log("✅ Email server connection successful");
          }
        });
      }
    }, 1000);
    
  } catch (error) {
    console.error("❌ Email transporter initialization failed:", error.message);
  }
};

// Initialize on module load
initTransporter();

const sendEmail = async (to, subject, html) => {
  try {
    if (!transporter) {
      console.warn("⚠️ Email transporter not initialized. Reinitializing...");
      initTransporter();
      if (!transporter) {
        return { success: false, error: "Transporter not available" };
      }
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Email credentials not configured.");
      return { success: false, error: "Credentials missing" };
    }

    const fromEmail = process.env.EMAIL_FROM || `"Beeyond Harvest" <${process.env.EMAIL_USER}>`;
    
    console.log(`📧 Sending email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    
    const mailOptions = {
      from: fromEmail,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject,
      html: html,
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log("✅ Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("❌ Email error:", error.message);
    
    // If IPv6 error, try alternative approach
    if (error.message.includes("ENETUNREACH") || error.message.includes("IPv6")) {
      console.log("🔄 Retrying with alternative SMTP server...");
      try {
        // Alternative: Use smtp-relay.gmail.com
        const altTransporter = nodemailer.createTransport({
          host: "smtp-relay.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          family: 4,
        });
        
        const mailOptions = {
          from: process.env.EMAIL_FROM || `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
          to: Array.isArray(to) ? to.join(", ") : to,
          subject: subject,
          html: html,
        };
        
        const info = await altTransporter.sendMail(mailOptions);
        console.log("✅ Email sent via alternative server:", info.messageId);
        return { success: true, messageId: info.messageId };
      } catch (altError) {
        console.error("❌ Alternative also failed:", altError.message);
        return { success: false, error: altError.message };
      }
    }
    
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("⚠️ Email not configured");
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
