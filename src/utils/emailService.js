// utils/emailService.js - ULTRA LIGHT, NO QUEUE, NO BLOCKING
// This version uses setImmediate and NEVER keeps the event loop busy

const nodemailer = require("nodemailer");

let transporter = null;
let consecutiveFailures = 0;
let lastFailureTime = 0;

// Simple transporter getter
const getTransporter = () => {
  // Return existing transporter if valid
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

  // No config = no emails
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT || "587", 10),
      secure: EMAIL_PORT === "465",
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      connectionTimeout: 3000,
      socketTimeout: 3000,
    });
    return transporter;
  } catch (err) {
    console.log("📧 Transporter error:", err.message);
    return null;
  }
};

// ULTRA SIMPLE - No queue, just fire and forget with timeout
const sendEmail = (to, subject, html) => {
  // Return immediately - don't wait
  setImmediate(() => {
    // Check cooldown
    if (consecutiveFailures >= 3 && Date.now() - lastFailureTime < 60000) {
      console.log("📧 Email cooldown active - skipping");
      return;
    }

    const transporter = getTransporter();
    if (!transporter) {
      console.log("📧 No transporter - skipping email");
      return;
    }

    if (!to || !subject) {
      console.log("📧 Invalid email data - skipping");
      return;
    }

    // Create timeout
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), 3000);
    });

    const sendPromise = transporter.sendMail({
      from: `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: (html || "").substring(0, 30000),
    });

    Promise.race([sendPromise, timeoutPromise])
      .then(() => {
        console.log(`✅ Email sent to ${to}`);
        consecutiveFailures = 0;
        clearTimeout(timeoutId);
      })
      .catch((err) => {
        console.log(`❌ Email failed (${err.message})`);
        consecutiveFailures++;
        lastFailureTime = Date.now();
        transporter = null; // Reset on failure
        clearTimeout(timeoutId);
      });
  });

  // Return immediately - never wait
  return Promise.resolve({ success: true, queued: true });
};

// Order confirmation
const sendOrderConfirmation = (order, email) => {
  const subject = `Order Confirmed - ${order.orderNumber}`;
  const html = `
    <h2>Order Confirmed ✅</h2>
    <p>Order #: ${order.orderNumber}</p>
    <p>Total: ৳${order.total?.toLocaleString() || 0}</p>
    <p>Thank you for shopping with Beeyond Harvest!</p>
  `;
  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendOrderConfirmation,
};
