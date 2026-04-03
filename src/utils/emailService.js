// utils/emailService.js — Brevo HTTP API (no SMTP, no port blocks)

let failureCount = 0;
let lastFailureTime = 0;

const CONFIG = {
  maxRetries: 2,
  retryDelay: 2000,
  cooldownMs: 120000,
  maxFailuresBeforeCooldown: 3,
  timeout: 15000,
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

const sendEmail = async (to, subject, html, retry = 0) => {
  if (process.env.DISABLE_EMAIL === "true")
    return { success: true, disabled: true };
  if (isInCooldown()) return { success: false, error: "Cooldown active" };
  if (!to || !subject || !html)
    return { success: false, error: "Invalid email data" };

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("❌ BREVO_API_KEY not set");
    return { success: false, error: "BREVO_API_KEY missing" };
  }

  try {
    console.log(`📧 Sending to ${to} via Brevo API (attempt ${retry + 1})`);

    const fromEmail = process.env.EMAIL_FROM || "noreply@beeyondharvestbd.com";
    const fromName = "Beeyond Harvest";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: html
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Email sent → ${to} [${data.messageId || "ok"}]`);
    failureCount = 0;
    return { success: true, messageId: data.messageId };
  } catch (err) {
    const msg = err.name === "AbortError" ? "Request timeout" : err.message;
    console.error(`❌ Email error (${to}): ${msg}`);
    failureCount++;
    lastFailureTime = Date.now();

    if (retry < CONFIG.maxRetries) {
      const delay = CONFIG.retryDelay * (retry + 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return sendEmail(to, subject, html, retry + 1);
    }

    return { success: false, error: msg };
  }
};

const sendEmailAsync = (to, subject, html) => {
  sendEmail(to, subject, html).catch((err) =>
    console.error("Async email error:", err.message),
  );
};

module.exports = { sendEmail, sendEmailAsync };
