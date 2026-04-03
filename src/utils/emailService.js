const nodemailer = require("nodemailer");

let transporter = null;
let initPromise = null;
let failureCount = 0;
let lastFailureTime = 0;

const CONFIG = {
  maxRetries: 1, // reduced — timeouts are slow, don't double the wait
  retryDelay: 3000,
  cooldownMs: 120000,
  timeout: 20000,
  verifyTimeout: 15000,
  maxFailuresBeforeCooldown: 3,
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
          console.warn(
            "⚠️ Email config missing — check EMAIL_HOST, EMAIL_USER, EMAIL_PASS",
          );
          return null;
        }

        const t = nodemailer.createTransport({
          host: EMAIL_HOST, // smtp-relay.brevo.com
          port: parseInt(EMAIL_PORT || "587", 10), // 587
          secure: false, // STARTTLS on 587
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
          tls: { rejectUnauthorized: false },
          connectionTimeout: CONFIG.timeout,
          socketTimeout: CONFIG.timeout,
          greetingTimeout: CONFIG.timeout,
        });

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

        transporter = t;
        console.log("✅ Transporter ready →", EMAIL_HOST);
        return transporter;
      } catch (err) {
        console.error("❌ Transporter init failed:", err.message);
        return null;
      } finally {
        initPromise = null;
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

    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    const info = await Promise.race([
      t.sendMail({
        from: `"Beeyond Harvest" <${fromEmail}>`,
        to,
        subject,
        html,
        text: html
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Send timeout")), CONFIG.timeout),
      ),
    ]);

    console.log(`✅ Email sent → ${to} [${info.messageId}]`);
    failureCount = 0;
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email error (${to}):`, err.message);
    failureCount++;
    lastFailureTime = Date.now();

    if (
      ["ECONNECTION", "ETIMEDOUT", "EAUTH", "ESOCKET", "ECONNRESET"].includes(
        err.code,
      )
    ) {
      transporter = null;
      initPromise = null;
      console.log("🔄 Transporter reset due to:", err.code);
    }

    if (retry < CONFIG.maxRetries) {
      const delay = CONFIG.retryDelay * (retry + 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
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
