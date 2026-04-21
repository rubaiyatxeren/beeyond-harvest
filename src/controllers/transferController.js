// controllers/transferController.js
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const Transfer = require("../models/Transfer");
const { sendEmail } = require("../utils/emailService");

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 10;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const TRANSFER_EXPIRY_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateOTP = () => {
  // 6-digit numeric OTP
  return String(Math.floor(100000 + Math.random() * 900000));
};

const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const isExpired = (transfer) => {
  return transfer.expiresAt && new Date() > new Date(transfer.expiresAt);
};

// ─── Email Templates ──────────────────────────────────────────────────────────

const generateOTPEmailTemplate = (senderName, senderEmail, otp, transferId) => {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="bn" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>BeeTransfer — OTP Verification</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:28px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- HEADER -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);border-radius:24px 24px 0 0;">
          <tr><td style="padding:40px 40px 20px;text-align:center;">
            <!-- Logo -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:48px;height:48px;text-align:center;vertical-align:middle;font-size:24px;line-height:48px;">🐝</td>
                <td style="padding-left:10px;text-align:left;vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:0.5px;">BeeTransfer</div>
                  <div style="font-size:10px;color:#FDD882;margin-top:1px;">by BeeHarvest</div>
                </td>
              </tr>
            </table>
            <div style="display:inline-block;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.35);border-radius:50px;padding:5px 18px;margin-bottom:16px;">
              <span style="color:#FDD882;font-size:11px;font-weight:600;letter-spacing:0.5px;">🔐 OTP যাচাইকরণ</span>
            </div>
            <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">আপনার ট্রান্সফার নিশ্চিত করুন</h1>
            <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;">
              <strong style="color:#FDD882;">${senderEmail}</strong> আপনাকে ফাইল পাঠাতে চাইছে
            </p>
          </td></tr>
          <tr><td style="line-height:0;font-size:0;">
            <svg width="100%" height="36" viewBox="0 0 520 36" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 C130,36 390,0 520,36 L520,36 L0,36 Z" fill="#FFF9F0"/>
            </svg>
          </td></tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#FFF9F0;padding:0 32px;">
        <div style="padding:28px 0 0;">
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
            নিচের <strong>৬-সংখ্যার OTP</strong> কোডটি ব্যবহার করে আপনার ফাইল ট্রান্সফার যাচাই করুন।<br/>
            <span style="color:#6B7A99;font-size:13px;">এই কোডটি ${OTP_TTL_MINUTES} মিনিটের জন্য বৈধ।</span>
          </p>
        </div>

        <!-- OTP Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
          <tr><td align="center">
            <table cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:20px;padding:32px 48px;">
              <tr><td style="text-align:center;">
                <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">আপনার OTP কোড</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:42px;font-weight:900;letter-spacing:12px;color:#FDD882;line-height:1;">${otp}</div>
                <div style="margin-top:12px;font-size:11px;color:rgba(255,255,255,0.35);">Transfer ID: ${transferId}</div>
              </td></tr>
            </table>
          </td></tr>
        </table>

        <!-- Warning -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3C7;border-left:3px solid #F5A623;border-radius:0 10px 10px 0;margin-bottom:28px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0;font-size:12px;color:#92400E;line-height:1.6;">
              ⚠️ এই OTP কোড <strong>কারো সাথে শেয়ার করবেন না।</strong> BeeTransfer কখনো আপনার OTP জিজ্ঞেস করবে না।
              কোড ${OTP_TTL_MINUTES} মিনিট পরে মেয়াদোত্তীর্ণ হবে।
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
          <tr><td style="padding:22px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;">🐝 BeeTransfer — BeeHarvest-এর নিরাপদ ফাইল ট্রান্সফার সার্ভিস</p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="height:24px;"></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
};

const generateReceiverEmailTemplate = (transfer) => {
  const year = new Date().getFullYear();
  const expiryDate = new Date(transfer.expiresAt).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const downloadUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/transfer/${transfer.transferId}`;

  const fileRows = transfer.files
    .map(
      (f, i) => `
    <tr style="background:${i % 2 === 0 ? "white" : "#F9FAFB"};">
      <td style="padding:12px 16px;font-size:13px;color:#0D1B3E;font-weight:600;border-bottom:1px solid #F0E8D8;">
        📄 ${f.originalName}
      </td>
      <td style="padding:12px 16px;text-align:right;font-size:12px;color:#6B7A99;border-bottom:1px solid #F0E8D8;white-space:nowrap;">
        ${formatBytes(f.sizeBytes)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="bn" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>BeeTransfer — আপনার কাছে ফাইল পাঠানো হয়েছে</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:28px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- HEADER -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);border-radius:24px 24px 0 0;">
          <tr><td style="padding:40px 40px 20px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:48px;height:48px;text-align:center;vertical-align:middle;font-size:24px;line-height:48px;">🐝</td>
                <td style="padding-left:10px;text-align:left;vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#fff;">BeeTransfer</div>
                  <div style="font-size:10px;color:#FDD882;margin-top:1px;">by BeeHarvest</div>
                </td>
              </tr>
            </table>
            <div style="display:inline-block;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);border-radius:50px;padding:5px 18px;margin-bottom:16px;">
              <span style="color:#6EE7B7;font-size:11px;font-weight:600;letter-spacing:0.5px;">📦 নতুন ফাইল এসেছে</span>
            </div>
            <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;">
              ${transfer.sender.name || transfer.sender.email} আপনাকে ফাইল পাঠিয়েছে!
            </h1>
            <p style="margin:0 0 28px;color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;">
              ${transfer.files.length}টি ফাইল • মোট ${formatBytes(transfer.totalSizeBytes)}
            </p>
          </td></tr>
          <tr><td style="line-height:0;font-size:0;">
            <svg width="100%" height="36" viewBox="0 0 560 36" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 C140,36 420,0 560,36 L560,36 L0,36 Z" fill="#FFF9F0"/>
            </svg>
          </td></tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#FFF9F0;padding:0 32px;">
        <div style="padding:28px 0 20px;">
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
            প্রিয় <strong style="color:#0D1B3E;">${transfer.receiver.name || transfer.receiver.email}</strong>,<br/>
            <strong style="color:#F5A623;">${transfer.sender.email}</strong> আপনার কাছে ফাইল পাঠিয়েছে।
            ${transfer.message ? `<br/><br/><em style="color:#6B7A99;">"${transfer.message}"</em>` : ""}
          </p>
        </div>

        <!-- Transfer Info Strip -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:14px;margin-bottom:20px;">
          <tr><td style="padding:16px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Transfer ID</div>
                  <div style="font-family:'Courier New',monospace;font-size:16px;font-weight:800;color:#FDD882;letter-spacing:1px;">${transfer.transferId}</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px;">মেয়াদ শেষ</div>
                  <div style="font-size:12px;font-weight:700;color:#FDD882;">${expiryDate}</div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- File List -->
        <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">📁 ফাইলসমূহ (${transfer.files.length}টি)</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;margin-bottom:22px;border:1px solid #F0E8D8;">
          <thead>
            <tr style="background:#0D1B3E;">
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">ফাইলের নাম</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">সাইজ</th>
            </tr>
          </thead>
          <tbody>${fileRows}</tbody>
        </table>

        <!-- Download CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
          <tr><td align="center">
            <a href="${downloadUrl}"
              style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:15px 44px;border-radius:50px;font-size:15px;font-weight:800;letter-spacing:0.3px;">
              ⬇️ ফাইল ডাউনলোড করুন
            </a>
          </td></tr>
        </table>

        <!-- Expiry warning -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border-left:3px solid #F5A623;border-radius:0 10px 10px 0;margin-bottom:28px;">
          <tr><td style="padding:12px 16px;">
            <p style="margin:0;font-size:12px;color:#92400E;line-height:1.6;">
              ⏰ এই ডাউনলোড লিংকটি <strong>${expiryDate}</strong> তারিখ পর্যন্ত বৈধ থাকবে।
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
          <tr><td style="padding:22px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.35);">🐝 BeeTransfer — BeeHarvest-এর নিরাপদ ফাইল ট্রান্সফার সার্ভিস</p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="height:24px;"></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
};

const generateSenderConfirmEmailTemplate = (transfer) => {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"/><title>BeeTransfer — ফাইল পাঠানো হয়েছে</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:28px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:24px 24px 0 0;">
          <tr><td style="padding:36px 36px 18px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr>
                <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:48px;height:48px;text-align:center;vertical-align:middle;font-size:24px;line-height:48px;">🐝</td>
                <td style="padding-left:10px;text-align:left;vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#fff;">BeeTransfer</div>
                  <div style="font-size:10px;color:#FDD882;margin-top:1px;">by BeeHarvest</div>
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">✅ ফাইল সফলভাবে পাঠানো হয়েছে!</h1>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:13px;">
              <strong style="color:#FDD882;">${transfer.receiver.email}</strong>-কে ${transfer.files.length}টি ফাইল পাঠানো হয়েছে
            </p>
          </td></tr>
          <tr><td style="line-height:0;font-size:0;">
            <svg width="100%" height="32" viewBox="0 0 520 32" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 C130,32 390,0 520,32 L520,32 L0,32 Z" fill="#FFF9F0"/>
            </svg>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#FFF9F0;padding:24px 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:14px;margin-bottom:20px;">
          <tr><td style="padding:16px 22px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Transfer ID</div>
            <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:800;color:#FDD882;letter-spacing:1px;">${transfer.transferId}</div>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6B7A99;text-align:center;line-height:1.6;">
          প্রাপক রিসিভার ইমেইলে ডাউনলোড লিংক পাঠানো হয়েছে। ফাইলগুলো ${TRANSFER_EXPIRY_DAYS} দিন পর মুছে যাবে।
        </p>
      </td></tr>
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
          <tr><td style="padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">&copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc   Initiate a transfer — upload files, validate, save draft, send OTP
 * @route  POST /api/transfers/initiate
 * @access Public
 */
const initiateTransfer = async (req, res) => {
  try {
    console.log("📤 [TRANSFER] New transfer initiation");
    console.log("📁 req.files:", req.files);
    console.log("📦 req.body:", req.body);
    console.log("🔑 Headers:", req.headers["content-type"]);

    // Check if files exist
    if (!req.files || req.files.length === 0) {
      console.error("❌ No files in request");
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const { senderEmail, senderName, receiverEmail, receiverName, message } =
      req.body;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!senderEmail || !receiverEmail) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver email addresses are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail) || !emailRegex.test(receiverEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address format",
      });
    }

    if (senderEmail.toLowerCase() === receiverEmail.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver cannot be the same email address",
      });
    }

    // ── Files validation ──────────────────────────────────────────────────────
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one file is required",
      });
    }

    if (req.files.length > MAX_FILES) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_FILES} files allowed per transfer`,
      });
    }

    // Check individual file sizes
    for (const file of req.files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          success: false,
          message: `File "${file.originalname}" exceeds the ${MAX_FILE_SIZE_MB}MB limit (${formatBytes(file.size)})`,
        });
      }
    }

    // ── Build file array ──────────────────────────────────────────────────────
    const files = req.files.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename || file.key || path.basename(file.path || ""),
      mimetype: file.mimetype,
      sizeBytes: file.size,
      // Cloudinary fields (populated when using cloudinary storage)
      cloudinaryUrl: file.path || "",
      cloudinaryPublicId: file.filename || "",
    }));

    // ── Create transfer (status: pending_otp) ─────────────────────────────────
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const transfer = await Transfer.create({
      sender: {
        email: senderEmail.toLowerCase().trim(),
        name: senderName || "",
      },
      receiver: {
        email: receiverEmail.toLowerCase().trim(),
        name: receiverName || "",
      },
      files,
      message: message || "",
      otp: {
        code: otpHash,
        expiresAt: otpExpiry,
        attempts: 0,
        verified: false,
      },
      status: "pending_otp",
      ipAddress:
        (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "unknown",
      userAgent: req.headers["user-agent"] || "",
    });

    console.log(`✅ [TRANSFER] Draft created: ${transfer.transferId}`);

    // ── Send OTP to sender ────────────────────────────────────────────────────
    const otpHtml = generateOTPEmailTemplate(
      senderName || senderEmail,
      senderEmail,
      otp,
      transfer.transferId,
    );

    const emailResult = await sendEmail(
      senderEmail,
      `🔐 BeeTransfer OTP — ${transfer.transferId}`,
      otpHtml,
    );

    if (!emailResult?.success) {
      // Clean up the draft and uploaded files on OTP send failure
      await Transfer.findByIdAndDelete(transfer._id);
      console.error(`❌ [TRANSFER] OTP email failed for ${senderEmail}`);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    console.log(`📧 [TRANSFER] OTP sent to ${senderEmail}`);

    res.status(201).json({
      success: true,
      data: {
        transferId: transfer.transferId,
        status: transfer.status,
        filesCount: files.length,
        totalSize: formatBytes(transfer.totalSizeBytes),
        otpExpiresAt: otpExpiry,
        message: `OTP sent to ${senderEmail}. Please verify within ${OTP_TTL_MINUTES} minutes.`,
      },
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Initiate error:", error.message);
    console.error("❌ Error stack:", error.stack);
    res
      .status(500)
      .json({ success: false, message: "Failed to initiate transfer" });
  }
};

/**
 * @desc   Verify OTP and dispatch the transfer
 * @route  POST /api/transfers/:transferId/verify-otp
 * @access Public
 */
const verifyOTPAndSend = async (req, res) => {
  try {
    const { transferId } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    // Fetch with otp.code (select: false field)
    const transfer = await Transfer.findOne({ transferId }).select("+otp.code");

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    // ── State checks ──────────────────────────────────────────────────────────
    if (transfer.status !== "pending_otp") {
      if (transfer.otp.verified) {
        return res.status(400).json({
          success: false,
          message: "This transfer has already been verified and sent",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Transfer is in "${transfer.status}" state — cannot verify OTP`,
      });
    }

    if (isExpired(transfer) || new Date() > new Date(transfer.otp.expiresAt)) {
      transfer.status = "expired";
      await transfer.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please initiate a new transfer.",
        code: "OTP_EXPIRED",
      });
    }

    // ── Attempt throttle ──────────────────────────────────────────────────────
    if (transfer.otp.attempts >= OTP_MAX_ATTEMPTS) {
      transfer.status = "failed";
      await transfer.save();
      return res.status(429).json({
        success: false,
        message: `Too many incorrect OTP attempts (max ${OTP_MAX_ATTEMPTS}). Transfer cancelled.`,
        code: "OTP_MAX_ATTEMPTS",
      });
    }

    // ── Verify hash ───────────────────────────────────────────────────────────
    const inputHash = hashOTP(String(otp).trim());
    if (inputHash !== transfer.otp.code) {
      transfer.otp.attempts += 1;
      await transfer.save();

      const remaining = OTP_MAX_ATTEMPTS - transfer.otp.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    // ── OTP correct — mark verified and update status ─────────────────────────
    transfer.otp.verified = true;
    transfer.otp.verifiedAt = new Date();
    transfer.status = "sent";
    transfer.otp.code = ""; // clear the hash — no longer needed
    await transfer.save();

    console.log(`✅ [TRANSFER] OTP verified: ${transfer.transferId}`);

    // ── Respond immediately, then send emails in background ───────────────────
    res.json({
      success: true,
      data: {
        transferId: transfer.transferId,
        status: transfer.status,
        receiver: transfer.receiver.email,
        filesCount: transfer.files.length,
        totalSize: formatBytes(transfer.totalSizeBytes),
        expiresAt: transfer.expiresAt,
      },
      message: "Transfer verified! Files are being sent to the receiver.",
    });

    // ── Background: send receiver + sender confirmation emails ────────────────
    setImmediate(async () => {
      try {
        const receiverHtml = generateReceiverEmailTemplate(transfer);
        const senderHtml = generateSenderConfirmEmailTemplate(transfer);

        const [receiverResult, senderResult] = await Promise.allSettled([
          sendEmail(
            transfer.receiver.email,
            `📦 ${transfer.sender.email} sent you ${transfer.files.length} file${transfer.files.length > 1 ? "s" : ""} via BeeTransfer`,
            receiverHtml,
          ),
          sendEmail(
            transfer.sender.email,
            `✅ BeeTransfer Confirmed — ${transfer.transferId}`,
            senderHtml,
          ),
        ]);

        if (
          receiverResult.status === "fulfilled" &&
          receiverResult.value?.success
        ) {
          console.log(
            `📧 [TRANSFER] Receiver email sent → ${transfer.receiver.email}`,
          );
        } else {
          console.error(
            `❌ [TRANSFER] Receiver email failed → ${transfer.receiver.email}`,
          );
        }

        if (
          senderResult.status === "fulfilled" &&
          senderResult.value?.success
        ) {
          console.log(
            `📧 [TRANSFER] Sender confirm email → ${transfer.sender.email}`,
          );
        }
      } catch (emailErr) {
        console.error(
          "❌ [TRANSFER] Background email error:",
          emailErr.message,
        );
      }
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Verify OTP error:", error.message);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};

/**
 * @desc   Resend OTP for a pending transfer
 * @route  POST /api/transfers/:transferId/resend-otp
 * @access Public
 */
const resendOTP = async (req, res) => {
  try {
    const { transferId } = req.params;

    const transfer = await Transfer.findOne({ transferId }).select("+otp.code");

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (transfer.status !== "pending_otp") {
      return res.status(400).json({
        success: false,
        message: "OTP can only be resent for pending transfers",
      });
    }

    if (isExpired(transfer)) {
      transfer.status = "expired";
      await transfer.save();
      return res.status(400).json({
        success: false,
        message: "Transfer has expired. Please initiate a new one.",
        code: "TRANSFER_EXPIRED",
      });
    }

    // Generate fresh OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    transfer.otp.code = otpHash;
    transfer.otp.expiresAt = otpExpiry;
    transfer.otp.attempts = 0;
    await transfer.save();

    const otpHtml = generateOTPEmailTemplate(
      transfer.sender.name || transfer.sender.email,
      transfer.sender.email,
      otp,
      transferId,
    );

    const result = await sendEmail(
      transfer.sender.email,
      `🔐 BeeTransfer OTP (Resent) — ${transferId}`,
      otpHtml,
    );

    if (!result?.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }

    console.log(`📧 [TRANSFER] OTP resent to ${transfer.sender.email}`);

    res.json({
      success: true,
      message: `New OTP sent to ${transfer.sender.email}`,
      otpExpiresAt: otpExpiry,
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Resend OTP error:", error.message);
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
};

/**
 * @desc   Get transfer details for download page (public — by transferId)
 * @route  GET /api/transfers/:transferId
 * @access Public
 */
const getTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;

    const transfer = await Transfer.findOne({ transferId }).lean();

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (isExpired(transfer)) {
      return res.status(410).json({
        success: false,
        message:
          "This transfer has expired and the files are no longer available.",
        code: "TRANSFER_EXPIRED",
      });
    }

    if (transfer.status === "pending_otp" || transfer.status === "failed") {
      return res.status(403).json({
        success: false,
        message: "Transfer files are not available yet",
        code: "TRANSFER_NOT_READY",
      });
    }

    // Return sanitized transfer info (no OTP hash)
    const { otp, ipAddress, userAgent, ...safeTransfer } = transfer;

    res.json({
      success: true,
      data: {
        ...safeTransfer,
        files: transfer.files.map((f) => ({
          _id: f._id,
          originalName: f.originalName,
          mimetype: f.mimetype,
          sizeBytes: f.sizeBytes,
          sizeFormatted: formatBytes(f.sizeBytes),
          downloadCount: f.downloadCount,
          cloudinaryUrl: f.cloudinaryUrl,
        })),
        totalSizeFormatted: formatBytes(transfer.totalSizeBytes),
      },
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Get transfer error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve transfer" });
  }
};

/**
 * @desc   Track a file download (increment counter)
 * @route  POST /api/transfers/:transferId/files/:fileId/download
 * @access Public
 */
const trackDownload = async (req, res) => {
  try {
    const { transferId, fileId } = req.params;

    const transfer = await Transfer.findOne({ transferId });

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (isExpired(transfer)) {
      return res
        .status(410)
        .json({ success: false, message: "Transfer has expired" });
    }

    const file = transfer.files.id(fileId);
    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    file.downloadCount += 1;
    if (transfer.status === "sent") {
      transfer.status = "downloaded";
    }
    await transfer.save();

    res.json({
      success: true,
      data: {
        downloadUrl: file.cloudinaryUrl,
        originalName: file.originalName,
        mimetype: file.mimetype,
      },
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Track download error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to track download" });
  }
};

/**
 * @desc   Get all transfers (admin view)
 * @route  GET /api/transfers
 * @access Private (Admin)
 */
const getAllTransfers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { transferId: { $regex: req.query.search, $options: "i" } },
        { "sender.email": { $regex: req.query.search, $options: "i" } },
        { "receiver.email": { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [transfers, total] = await Promise.all([
      Transfer.find(query)
        .select("-otp.code")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Transfer.countDocuments(query),
    ]);

    const formatted = transfers.map((t) => ({
      ...t,
      totalSizeFormatted: formatBytes(t.totalSizeBytes),
      files: t.files.map((f) => ({
        ...f,
        sizeFormatted: formatBytes(f.sizeBytes),
      })),
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Get all transfers error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get transfer statistics (admin)
 * @route  GET /api/transfers/stats
 * @access Private (Admin)
 */
const getTransferStats = async (req, res) => {
  try {
    const [total, pending, sent, downloaded, expired, failed, totalFilesAgg] =
      await Promise.all([
        Transfer.countDocuments(),
        Transfer.countDocuments({ status: "pending_otp" }),
        Transfer.countDocuments({ status: { $in: ["otp_verified", "sent"] } }),
        Transfer.countDocuments({ status: "downloaded" }),
        Transfer.countDocuments({ status: "expired" }),
        Transfer.countDocuments({ status: "failed" }),
        Transfer.aggregate([
          {
            $group: {
              _id: null,
              totalFiles: { $sum: { $size: "$files" } },
              totalBytes: { $sum: "$totalSizeBytes" },
            },
          },
        ]),
      ]);

    const agg = totalFilesAgg[0] || { totalFiles: 0, totalBytes: 0 };

    res.json({
      success: true,
      data: {
        total,
        pending,
        sent,
        downloaded,
        expired,
        failed,
        totalFilesTransferred: agg.totalFiles,
        totalDataTransferred: formatBytes(agg.totalBytes),
        totalDataTransferredBytes: agg.totalBytes,
      },
    });
  } catch (error) {
    console.error("❌ [TRANSFER] Stats error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Delete a transfer (admin)
 * @route  DELETE /api/transfers/:transferId
 * @access Private (Admin)
 */
const deleteTransfer = async (req, res) => {
  try {
    const transfer = await Transfer.findOne({
      transferId: req.params.transferId,
    });

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    // Optionally delete Cloudinary files
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const cloudinary = require("../config/cloudinary");
        for (const file of transfer.files) {
          if (file.cloudinaryPublicId) {
            await cloudinary.uploader.destroy(file.cloudinaryPublicId, {
              resource_type: "raw",
            });
          }
        }
      } catch (cloudErr) {
        console.warn(
          "⚠️ [TRANSFER] Cloudinary cleanup partial:",
          cloudErr.message,
        );
      }
    }

    await Transfer.findByIdAndDelete(transfer._id);
    console.log(`🗑️ [TRANSFER] Deleted: ${transfer.transferId}`);

    res.json({ success: true, message: "Transfer deleted successfully" });
  } catch (error) {
    console.error("❌ [TRANSFER] Delete error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  initiateTransfer,
  verifyOTPAndSend,
  resendOTP,
  getTransfer,
  trackDownload,
  getAllTransfers,
  getTransferStats,
  deleteTransfer,
};
