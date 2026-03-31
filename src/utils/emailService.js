// utils/emailService.js
// Provider: Gmail SMTP port 465 (SSL) — works on Render (port 587 is blocked)

const nodemailer = require("nodemailer");

let transporter = null;
let verified = false;
let verifying = null; // Promise lock to prevent concurrent init

/**
 * Build + verify the transporter exactly once.
 * Returns the transporter on success, throws on failure.
 */
const initTransporter = async () => {
  // Already good — return immediately
  if (transporter && verified) return transporter;

  // Another call is already initializing — wait for it
  if (verifying) return verifying;

  verifying = (async () => {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      throw new Error(
        "Email not configured: Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS",
      );
    }

    const port = parseInt(EMAIL_PORT || "465", 10);
    const secure = port === 465;

    const t = nodemailer.createTransport({
      host: EMAIL_HOST, // smtp.gmail.com
      port, // 465
      secure, // true → SSL (not STARTTLS)
      auth: {
        user: EMAIL_USER, // ytvech@gmail.com
        pass: EMAIL_PASS, // 16-char Gmail App Password
      },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    // Await verify properly — no callback race
    await new Promise((resolve, reject) => {
      t.verify((err) => (err ? reject(err) : resolve()));
    });

    console.log(`✅ Gmail SMTP verified on port ${port} (SSL)`);
    transporter = t;
    verified = true;
    return transporter;
  })()
    .catch((err) => {
      // Reset everything so the next sendEmail call retries from scratch
      console.error("❌ Email transporter init failed:", err.message);
      transporter = null;
      verified = false;
      verifying = null;
      throw err;
    })
    .finally(() => {
      // Clear the lock whether we succeeded or failed
      verifying = null;
    });

  return verifying;
};

// Warm up on module load (non-blocking — errors are swallowed here,
// sendEmail will retry if needed)
if (
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
) {
  initTransporter().catch(() => {});
}

/**
 * Send an email.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
const sendEmail = async (to, subject, html) => {
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled (DISABLE_EMAIL=true)");
    return { success: true, message: "Email disabled" };
  }

  try {
    const t = await initTransporter(); // always await — safe if already verified

    const from = `"Beeyond Harvest 🌾" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;

    console.log(`📧 Sending email → ${to} | "${subject}"`);
    const info = await t.sendMail({ from, to, subject, html });
    console.log(`✅ Email sent → ${to} | messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send email → ${to}:`, err.message);

    // Force re-init on next attempt for connection/auth errors
    if (["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(err.code)) {
      console.log("🔄 Resetting transporter for next attempt...");
      transporter = null;
      verified = false;
      verifying = null;
    }

    return { success: false, error: err.message, code: err.code };
  }
};

/**
 * Quick smoke-test. Call from a temp route and remove after confirming.
 * GET /api/orders/test-email
 */
const testEmailService = async (testTo) => {
  const to = testTo || process.env.EMAIL_USER;
  console.log(`🧪 Sending test email → ${to}`);
  const result = await sendEmail(
    to,
    "🧪 Beeyond Harvest — Email Test",
    `<p style="font-family:sans-serif">
       ✅ Email service is working!<br/>
       <strong>Sent at:</strong> ${new Date().toLocaleString()}
     </p>`,
  );
  console.log(result.success ? "🎉 Test PASSED" : "❌ Test FAILED", result);
  return result;
};

module.exports = { sendEmail, testEmailService };
