// routes/emailRoutes.js (new file for email testing)
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { sendEmail, testEmailConfig } = require("../utils/emailService");

// Test email endpoint
router.post("/test", protect, async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const html = `
      <h2>Test Email from Beeyond Harvest</h2>
      <p>${message || "This is a test email to verify the email configuration."}</p>
      <p>Time: ${new Date().toLocaleString()}</p>
    `;
    await sendEmail(
      to || process.env.EMAIL_USER,
      subject || "Test Email",
      html,
    );
    res.json({ success: true, message: "Test email sent" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check email config
router.get("/status", protect, async (req, res) => {
  const status = await testEmailConfig();
  res.json({
    success: status,
    configured: !!process.env.EMAIL_USER,
    host: process.env.EMAIL_HOST || "not configured",
  });
});

module.exports = router;
