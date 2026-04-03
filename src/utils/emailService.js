const nodemailer = require("nodemailer");
const dns = require("dns").promises;

let transporter = null;
let initPromise = null;
let failureCount = 0;
let lastFailureTime = 0;

const CONFIG = {
  maxRetries: 2,
  retryDelay: 2000,
  cooldownMs: 120000,
  timeout: 15000,
  verifyTimeout: 20000,
  maxFailuresBeforeCooldown: 3,
};

const resolveIPv4 = async (host) => {
  try {
    const ips = await dns.resolve4(host);
    return ips?.[0] || host;
  } catch {
    return host;
  }
};

const isInCooldown = () => {
  if (failureCount < CONFIG.maxFailuresBeforeCooldown) return false;
  if (Date.now() - lastFailureTime < CONFIG.cooldownMs) {
    console.log("⏸️ Email cooldown active");
    return true;
  }
  failureCount = 0;
  return false;
};

const getTransporter = () => {
  if (transporter) return Promise.resolve(transporter);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_PORT } = process.env;
        if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
          console.warn("⚠️ Email config missing");
          return null;
        }

        const host = await resolveIPv4(EMAIL_HOST);

        const t = nodemailer.createTransport({
          host,
          port: parseInt(EMAIL_PORT || "587", 10), // 587 STARTTLS — reliable on Render
          secure: false,
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
          tls: { rejectUnauthorized: false },
          connectionTimeout: CONFIG.timeout,
          socketTimeout: CONFIG.timeout,
          greetingTimeout: CONFIG.timeout,
        });

        // ✅ verify is best-effort — we assign transporter regardless
        try {
          await Promise.race([
            t.verify(),
            new Promise((_, r) =>
              setTimeout(
                () => r(new Error("verify timeout")),
                CONFIG.verifyTimeout,
              ),
            ),
          ]);
          console.log("✅ SMTP verified");
        } catch (e) {
          console.warn("⚠️ SMTP verify warn (still usable):", e.message);
        }

        // ✅ CRITICAL: assign AFTER verify attempt, not inside try-catch above
        transporter = t;
        console.log("✅ Transporter ready");
        return transporter;
      } catch (err) {
        console.error("❌ Transporter init failed:", err.message);
        return null;
      } finally {
        initPromise = null; // allow retry on next call
      }
    })();
  }
  return initPromise;
};

const sendEmail = async (to, subject, html, retry = 0) => {
  if (process.env.DISABLE_EMAIL === "true")
    return { success: true, disabled: true };
  if (isInCooldown()) return { success: false, error: "Cooldown active" };
  if (!to || !subject || !html)
    return { success: false, error: "Invalid email data" };

  try {
    const t = await getTransporter();
    if (!t) return { success: false, error: "Transporter unavailable" };

    console.log(`📧 Sending to ${to} (attempt ${retry + 1})`);

    const info = await Promise.race([
      t.sendMail({
        from: `"Beeyond Harvest" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Send timeout")), CONFIG.timeout),
      ),
    ]);

    console.log("✅ Email sent:", info.messageId);
    failureCount = 0;
    return { success: true };
  } catch (err) {
    console.error("❌ Email error:", err.message);
    failureCount++;
    lastFailureTime = Date.now();

    // reset transporter on connection-level errors
    if (
      ["ECONNECTION", "ETIMEDOUT", "EAUTH", "ESOCKET", "ECONNRESET"].includes(
        err.code,
      )
    ) {
      transporter = null;
    }

    if (retry < CONFIG.maxRetries) {
      await new Promise((r) => setTimeout(r, CONFIG.retryDelay * (retry + 1)));
      return sendEmail(to, subject, html, retry + 1);
    }

    return { success: false, error: err.message };
  }
};

const sendEmailAsync = (to, subject, html) => {
  sendEmail(to, subject, html).catch((err) =>
    console.error("Async email error:", err.message),
  );
};

module.exports = { sendEmail, sendEmailAsync };
