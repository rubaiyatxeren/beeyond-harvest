// utils/emailService.js
// Provider: Gmail SMTP port 465 (SSL) — IPv4 forced for Render compatibility

const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let verified = false;
let verifying = null;

/**
 * Resolve smtp.gmail.com to an IPv4 address to bypass Render's IPv6 issue.
 */
const resolveIPv4 = async (hostname) => {
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses && addresses.length > 0) {
      console.log(`🔍 Resolved ${hostname} → ${addresses[0]} (IPv4)`);
      return addresses[0];
    }
  } catch (err) {
    console.warn(`⚠️ IPv4 DNS resolve failed for ${hostname}:`, err.message);
  }
  return hostname; // fallback to hostname if resolve fails
};

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

    // ✅ Resolve to IPv4 first — avoids ENETUNREACH on Render
    const resolvedHost = await resolveIPv4(EMAIL_HOST);

    const t = nodemailer.createTransport({
      host:   resolvedHost,   // IPv4 address e.g. 74.125.x.x
      port,
      secure,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      // ✅ Must set servername for TLS since we're using IP not hostname
      tls: {
        servername: EMAIL_HOST, // smtp.gmail.com — for cert validation
        rejectUnauthorized: true,
      },
      family: 4,              // extra safety: socket IPv4 only
      connectionTimeout: 15000,
      greetingTimeout:   10000,
      socketTimeout:     20000,
    });

    await new Promise((resolve, reject) => {
      t.verify((err) => (err ? reject(err) : resolve()));
    });

    console.log(`✅ Gmail SMTP verified → ${resolvedHost}:${port} (SSL, IPv4)`);
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

// Warm up on module load (non-blocking)
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
