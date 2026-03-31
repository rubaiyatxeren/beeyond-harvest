// utils/emailService.js
const nodemailer = require("nodemailer");
const dns = require("dns");

// ✅ Force IPv4 — Render doesn't support IPv6 outbound (ENETUNREACH fix)
dns.setDefaultResultOrder("ipv4first");

let transporter = null;
let verified = false;
let verifying = null;

const initTransporter = async () => {
  if (transporter && verified) return transporter;
  if (verifying) return verifying;

  verifying = (async () => {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;

    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
      throw new Error(
        "Email not configured: Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS"
      );
    }

    const port   = parseInt(EMAIL_PORT || "465", 10);
    const secure = port === 465;

    const t = nodemailer.createTransport({
      host:   EMAIL_HOST,
      port,
      secure,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      // ✅ Force IPv4 at socket level too
      family: 4,
      tls: { rejectUnauthorized: true },
      connectionTimeout: 15000,
      greetingTimeout:   10000,
      socketTimeout:     20000,
    });

    await new Promise((resolve, reject) => {
      t.verify((err) => (err ? reject(err) : resolve()));
    });

    console.log(`✅ Gmail SMTP verified on port ${port} (SSL, IPv4)`);
    transporter = t;
    verified    = true;
    return transporter;
  })()
    .catch((err) => {
      console.error("❌ Email transporter init failed:", err.message);
      transporter = null;
      verified    = false;
      verifying   = null;
      throw err;
    })
    .finally(() => {
      verifying = null;
    });

  return verifying;
};

// Warm up on module load
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  initTransporter().catch(() => {});
}

const sendEmail = async (to, subject, html) => {
  if (process.env.DISABLE_EMAIL === "true") {
    console.log("📧 Email disabled (DISABLE_EMAIL=true)");
    return { success: true, message: "Email disabled" };
  }

  try {
    const t = await initTransporter();
    const from = `"Beeyond Harvest 🌾" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;

    console.log(`📧 Sending email → ${to} | "${subject}"`);
    const info = await t.sendMail({ from, to, subject, html });
    console.log(`✅ Email sent → ${to} | messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error(`❌ Failed to send email → ${to}:`, err.message);

    if (["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "ENETUNREACH"].includes(err.code)) {
      console.log("🔄 Resetting transporter for next attempt...");
      transporter = null;
      verified    = false;
      verifying   = null;
    }

    return { success: false, error: err.message, code: err.code };
  }
};

const testEmailService = async (testTo) => {
  const to = testTo || process.env.EMAIL_USER;
  console.log(`🧪 Sending test email → ${to}`);
  const result = await sendEmail(
    to,
    "🧪 Beeyond Harvest — Email Test",
    `<p style="font-family:sans-serif">
       ✅ Email service is working!<br/>
       <strong>Sent at:</strong> ${new Date().toLocaleString()}
     </p>`
  );
  console.log(result.success ? "🎉 Test PASSED" : "❌ Test FAILED", result);
  return result;
};

module.exports = { sendEmail, testEmailService };
