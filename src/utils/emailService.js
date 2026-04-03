// utils/emailService.js - WILL SEND EMAILS, NO CRASHES
const nodemailer = require("nodemailer");

let transporter = null;
let consecutiveFailures = 0;
let lastFailureTime = 0;

// Get transporter - reuses if working
const getTransporter = () => {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.log("📧 Email config missing - emails disabled");
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT || "587", 10),
      secure: EMAIL_PORT === "465",
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      connectionTimeout: 5000,
      socketTimeout: 5000,
    });
    console.log("✅ Email transporter ready");
    return transporter;
  } catch (err) {
    console.log("📧 Transporter error:", err.message);
    return null;
  }
};

// Send email - ALWAYS returns immediately, NEVER blocks
const sendEmail = (to, subject, html) => {
  // Return a promise that resolves immediately
  return new Promise((resolve) => {
    // Skip if no recipient
    if (!to || !subject) {
      console.log("📧 Skipping - invalid email data");
      resolve({ success: false, error: "Invalid data" });
      return;
    }

    // Check cooldown after multiple failures
    if (consecutiveFailures >= 3 && Date.now() - lastFailureTime < 60000) {
      console.log("📧 Email cooldown active - skipping");
      resolve({ success: false, error: "Cooldown" });
      return;
    }

    const transporter = getTransporter();
    if (!transporter) {
      console.log("📧 No transporter - skipping");
      resolve({ success: false, error: "No transporter" });
      return;
    }

    // Send email in background - don't await
    const sendPromise = transporter.sendMail({
      from: `"Beeyond Harvest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: (html || "").substring(0, 50000),
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      console.log(`📧 Timeout sending to ${to}`);
      consecutiveFailures++;
      lastFailureTime = Date.now();
      transporter = null;
      resolve({ success: false, error: "Timeout" });
    }, 5000);

    // Handle result
    sendPromise
      .then((info) => {
        clearTimeout(timeoutId);
        console.log(`✅ Email sent to ${to}`);
        consecutiveFailures = 0;
        resolve({ success: true, messageId: info.messageId });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.log(`❌ Email failed to ${to}: ${err.message}`);
        consecutiveFailures++;
        lastFailureTime = Date.now();
        transporter = null;
        resolve({ success: false, error: err.message });
      });
  });
};

// Order confirmation helper
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
