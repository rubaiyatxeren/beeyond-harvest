const Complaint = require("../models/Complaint");
const Order = require("../models/Order");
const { sendEmail } = require("../utils/emailService");

// ═══════════════════════════════════════════════════════════════════════════════
// ██ EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS = {
  wrong_product: "ভুল পণ্য",
  damaged_product: "নষ্ট পণ্য",
  missing_item: "পণ্য পাইনি",
  delivery_issue: "ডেলিভারি সমস্যা",
  payment_issue: "পেমেন্ট সমস্যা",
  refund_request: "রিফান্ড অনুরোধ",
  quality_issue: "মানসম্পন্ন নয়",
  late_delivery: "দেরিতে ডেলিভারি",
  rude_behavior: "অভদ্র আচরণ",
  other: "অন্যান্য",
};

const PRIORITY_CONFIG = {
  low: { color: "#64748B", bg: "#F1F5F9", label: "নিম্ন", icon: "🔵" },
  medium: { color: "#F59E0B", bg: "#FFFBEB", label: "মধ্যম", icon: "🟡" },
  high: { color: "#EF4444", bg: "#FEF2F2", label: "উচ্চ", icon: "🔴" },
  urgent: { color: "#DC2626", bg: "#FFF0F0", label: "জরুরি", icon: "🚨" },
};

const STATUS_CONFIG = {
  open: { color: "#3B82F6", bg: "#EFF6FF", label: "খোলা", icon: "📬" },
  under_review: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    label: "রিভিউয়ের মধ্যে",
    icon: "🔍",
  },
  on_hold: { color: "#F59E0B", bg: "#FFFBEB", label: "স্থগিত", icon: "⏸️" },
  escalated: {
    color: "#DC2626",
    bg: "#FEF2F2",
    label: "এস্কালেটেড",
    icon: "⬆️",
  },
  resolved: {
    color: "#10B981",
    bg: "#ECFDF5",
    label: "সমাধান হয়েছে",
    icon: "✅",
  },
  rejected: { color: "#6B7280", bg: "#F9FAFB", label: "বাতিল", icon: "❌" },
  closed: { color: "#374151", bg: "#F3F4F6", label: "বন্ধ", icon: "🔒" },
};

// ── Customer confirmation email (on complaint submission) ─────────────────────
const generateComplaintConfirmationEmail = (complaint) => {
  const pc = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>অভিযোগ নিবন্ধন নিশ্চিত — BeeHarvest</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);border-radius:24px 24px 0 0;">
      <tr><td style="padding:40px 40px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
          <tr>
            <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;font-size:26px;line-height:52px;">🐝</td>
            <td style="padding-left:12px;text-align:left;vertical-align:middle;">
              <div style="font-size:22px;font-weight:800;color:white;">BeeHarvest</div>
              <div style="font-size:11px;color:#FDD882;margin-top:2px;">গ্রাহক সেবা কেন্দ্র</div>
            </td>
          </tr>
        </table>
        <div style="display:inline-block;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.35);border-radius:50px;padding:6px 20px;margin-bottom:20px;">
          <span style="color:#FDD882;font-size:12px;font-weight:600;letter-spacing:0.5px;">📋 অভিযোগ গ্রহণ নিশ্চিত</span>
        </div>
        <h1 style="margin:0 0 10px;color:white;font-size:26px;font-weight:800;">আপনার অভিযোগ পেয়েছি!</h1>
        <p style="margin:0 0 32px;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">আমরা দ্রুত সমাধানের চেষ্টা করব। নিচে আপনার টিকেটের বিবরণ দেওয়া হলো।</p>
      </td></tr>
      <tr><td style="line-height:0;font-size:0;">
        <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z" fill="#FFF9F0"/>
        </svg>
      </td></tr>
    </table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#FFF9F0;padding:0 32px;">
    <div style="padding:28px 0 0;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
        প্রিয় <strong style="color:#0D1B3E;">${complaint.customer.name}</strong>,<br/>
        <span style="font-size:14px;color:#6B7A99;">আপনার অভিযোগটি আমাদের সিস্টেমে নিবন্ধিত হয়েছে। আমাদের দল শীঘ্রই আপনার সাথে যোগাযোগ করবে।</span>
      </p>
    </div>

    <!-- Ticket strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">টিকেট নম্বর</div>
              <div style="font-size:20px;font-weight:800;color:#FDD882;letter-spacing:1px;font-family:'Courier New',monospace;">${complaint.ticketNumber}</div>
            </td>
            <td align="right">
              <div style="background:${pc.bg};color:${pc.color};padding:8px 16px;border-radius:50px;font-size:12px;font-weight:700;white-space:nowrap;">${pc.icon} ${pc.label} অগ্রাধিকার</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;">📋 অভিযোগের বিবরণ</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-bottom:12px;vertical-align:top;">
              <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;">বিভাগ</div>
              <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${CATEGORY_LABELS[complaint.category] || complaint.category}</div>
            </td>
            <td width="50%" style="padding-bottom:12px;vertical-align:top;">
              <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;">তারিখ</div>
              <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${new Date(complaint.createdAt).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-bottom:12px;vertical-align:top;">
              <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;">বিষয়</div>
              <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${complaint.subject}</div>
            </td>
          </tr>
          ${
            complaint.orderNumber
              ? `<tr><td colspan="2" style="vertical-align:top;">
            <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;">অর্ডার নম্বর</div>
            <div style="font-size:13px;font-weight:700;color:#F5A623;font-family:'Courier New',monospace;">${complaint.orderNumber}</div>
          </td></tr>`
              : ""
          }
        </table>
      </td></tr>
    </table>

    <!-- What happens next -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;">🚀 পরবর্তী পদক্ষেপ</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:32px;height:32px;background:#0D1B3E;border-radius:50%;text-align:center;font-size:14px;line-height:32px;vertical-align:middle;">1️⃣</td>
                <td style="padding-left:12px;font-size:13px;color:#374151;vertical-align:middle;">আমাদের টিম আপনার অভিযোগটি পর্যালোচনা করবে</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:32px;height:32px;background:#0D1B3E;border-radius:50%;text-align:center;font-size:14px;line-height:32px;vertical-align:middle;">2️⃣</td>
                <td style="padding-left:12px;font-size:13px;color:#374151;vertical-align:middle;">প্রয়োজনে আমরা আপনার সাথে যোগাযোগ করব</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:32px;height:32px;background:#0D1B3E;border-radius:50%;text-align:center;font-size:14px;line-height:32px;vertical-align:middle;">3️⃣</td>
                <td style="padding-left:12px;font-size:13px;color:#374151;vertical-align:middle;">সমাধান হলে আপনাকে ইমেইলে জানানো হবে (সাধারণত ২৪–৪৮ ঘণ্টার মধ্যে)</td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td align="center">
        <a href="${shopUrl}?ticket=${complaint.ticketNumber}" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:15px 40px;border-radius:50px;font-size:15px;font-weight:800;">
          📋 টিকেট ট্র্যাক করুন
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
      <tr><td style="padding:30px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়</p>
        <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.35);">সাহায্যের জন্য: <a href="mailto:support@beeharvest.com.bd" style="color:#FDD882;text-decoration:none;">support@beeharvest.com.bd</a></p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">© ${new Date().getFullYear()} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="height:24px;"></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// ── Status update email ───────────────────────────────────────────────────────
const generateStatusUpdateEmail = (complaint, extraMessage = "") => {
  const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const resolutionBlock =
    complaint.status === "resolved" && complaint.resolution
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;color:#FDD882;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;">🎯 সমাধানের বিবরণ</div>
        ${complaint.resolution.details ? `<p style="margin:0 0 12px;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.7;">${complaint.resolution.details}</p>` : ""}
        ${complaint.resolution.refundAmount ? `<p style="margin:0 0 8px;font-size:14px;color:#86efac;">💰 রিফান্ড পরিমাণ: <strong>${complaint.resolution.refundAmount.toLocaleString()} ৳</strong></p>` : ""}
        ${complaint.resolution.couponCode ? `<p style="margin:0;font-size:14px;color:#FDD882;">🎟️ কুপন কোড: <strong style="font-family:'Courier New',monospace;font-size:18px;letter-spacing:2px;">${complaint.resolution.couponCode}</strong></p>` : ""}
      </td></tr>
    </table>`
      : "";

  const rejectionBlock =
    complaint.status === "rejected"
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-size:13px;font-weight:700;color:#DC2626;margin-bottom:8px;">❌ অভিযোগ বাতিলের কারণ</div>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${complaint.rejectionNote || "প্রদত্ত তথ্য আমাদের নীতিমালার সাথে সামঞ্জস্যপূর্ণ নয়।"}</p>
      </td></tr>
    </table>`
      : "";

  const holdBlock =
    complaint.status === "on_hold"
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:16px;margin-bottom:20px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:8px;">⏸️ অতিরিক্ত তথ্য প্রয়োজন</div>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${complaint.holdReason || "আপনার অভিযোগটি প্রক্রিয়া করার জন্য আমাদের আরও তথ্য প্রয়োজন। অনুগ্রহ করে ইমেইলে উত্তর দিন।"}</p>
      </td></tr>
    </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"/><title>টিকেট আপডেট — BeeHarvest</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);border-radius:24px 24px 0 0;">
      <tr><td style="padding:40px 40px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr>
            <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;font-size:26px;line-height:52px;">🐝</td>
            <td style="padding-left:12px;text-align:left;vertical-align:middle;">
              <div style="font-size:22px;font-weight:800;color:white;">BeeHarvest</div>
              <div style="font-size:11px;color:#FDD882;">গ্রাহক সেবা</div>
            </td>
          </tr>
        </table>
        <div style="background:${sc.bg};color:${sc.color};display:inline-block;padding:8px 22px;border-radius:50px;font-size:13px;font-weight:700;margin-bottom:16px;">${sc.icon} ${sc.label}</div>
        <h1 style="margin:0 0 10px;color:white;font-size:24px;font-weight:800;">আপনার টিকেট আপডেট হয়েছে</h1>
        <p style="margin:0 0 32px;color:rgba(255,255,255,0.65);font-size:14px;">টিকেট নং: <strong style="color:#FDD882;font-family:'Courier New',monospace;">${complaint.ticketNumber}</strong></p>
      </td></tr>
      <tr><td style="line-height:0;font-size:0;">
        <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z" fill="#FFF9F0"/>
        </svg>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#FFF9F0;padding:28px 32px;">
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">প্রিয় <strong style="color:#0D1B3E;">${complaint.customer.name}</strong>,</p>
    ${extraMessage ? `<p style="margin:0 0 20px;font-size:14px;color:#374151;background:#F0F9FF;border-left:4px solid #3B82F6;padding:14px 16px;border-radius:0 12px 12px 0;line-height:1.7;">${extraMessage}</p>` : ""}
    ${resolutionBlock}
    ${rejectionBlock}
    ${holdBlock}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td align="center">
        <a href="${shopUrl}?ticket=${complaint.ticketNumber}" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:800;">
          📋 টিকেট দেখুন
        </a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
      <tr><td style="padding:24px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.4);">সাহায্যের জন্য: <a href="mailto:support@beeharvest.com.bd" style="color:#FDD882;text-decoration:none;">support@beeharvest.com.bd</a></p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">© ${new Date().getFullYear()} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="height:24px;"></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// ── Reply notification email ──────────────────────────────────────────────────
const generateReplyEmail = (complaint, replyMessage) => {
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"/><title>নতুন বার্তা — BeeHarvest</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:24px 24px 0 0;padding:36px 40px 28px;text-align:center;">
    <div style="font-size:36px;margin-bottom:12px;">💬</div>
    <h1 style="margin:0 0 8px;color:white;font-size:22px;font-weight:800;">আপনার অভিযোগে নতুন উত্তর এসেছে</h1>
    <p style="margin:0;color:rgba(255,255,255,0.6);font-size:13px;">টিকেট: <span style="color:#FDD882;font-family:'Courier New',monospace;">${complaint.ticketNumber}</span></p>
  </td></tr>
  <tr><td style="background:#FFF9F0;padding:28px 32px;">
    <p style="margin:0 0 20px;font-size:15px;color:#374151;">প্রিয় <strong>${complaint.customer.name}</strong>,</p>
    <div style="background:#F0F9FF;border:1px solid #BFDBFE;border-radius:14px;padding:18px 20px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#1E40AF;margin-bottom:8px;">🛎️ BeeHarvest সাপোর্ট টিম:</div>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.75;">${replyMessage}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${shopUrl}?ticket=${complaint.ticketNumber}" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:800;">
          💬 উত্তর দিন
        </a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#0D1B3E;border-radius:0 0 24px 24px;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">© ${new Date().getFullYear()} BeeHarvest | <a href="mailto:support@beeharvest.com.bd" style="color:#FDD882;text-decoration:none;">support@beeharvest.com.bd</a></p>
  </td></tr>
  <tr><td style="height:24px;"></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// ── Admin new-complaint notification email ────────────────────────────────────
const generateAdminComplaintEmail = (complaint) => {
  const pc = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
  const adminUrl = process.env.ADMIN_URL || "http://localhost:5000";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:20px 20px 0 0;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:16px;font-weight:800;color:white;">🐝 BeeHarvest Admin</div>
          <div style="font-size:11px;color:#FDD882;margin-top:2px;">অভিযোগ সিস্টেম</div>
        </td>
        <td align="right"><span style="background:${pc.bg};color:${pc.color};padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;">${pc.icon} ${pc.label}</span></td>
      </tr>
    </table>
    <div style="margin-top:20px;font-size:22px;font-weight:800;color:white;">🆕 নতুন অভিযোগ এসেছে!</div>
    <div style="font-family:monospace;font-size:15px;color:#FDD882;margin-top:6px;">${complaint.ticketNumber}</div>
  </td></tr>
  <tr><td style="background:white;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;margin-bottom:20px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:14px;">👤 গ্রাহকের তথ্য</div>
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:#94A3B8;">নাম:</span> <strong style="font-size:13px;color:#0D1B3E;">${complaint.customer.name}</strong></div>
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:#94A3B8;">ইমেইল:</span> <span style="font-size:13px;color:#F5A623;">${complaint.customer.email}</span></div>
        ${complaint.customer.phone ? `<div style="margin-bottom:8px;"><span style="font-size:11px;color:#94A3B8;">ফোন:</span> <strong style="font-size:13px;color:#0D1B3E;font-family:monospace;">${complaint.customer.phone}</strong></div>` : ""}
        ${complaint.orderNumber ? `<div><span style="font-size:11px;color:#94A3B8;">অর্ডার:</span> <strong style="font-size:13px;color:#F5A623;font-family:monospace;">${complaint.orderNumber}</strong></div>` : ""}
      </td></tr>
    </table>
    <div style="font-size:12px;font-weight:700;color:#0D1B3E;margin-bottom:8px;">${CATEGORY_LABELS[complaint.category]} — ${complaint.subject}</div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;font-size:13px;color:#374151;line-height:1.7;margin-bottom:24px;">${complaint.description}</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${adminUrl}/admin/complaints/${complaint._id}" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:800;">
        ⚡ অভিযোগ দেখুন ও পদক্ষেপ নিন
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#1E293B;border-radius:0 0 20px 20px;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">BeeHarvest Complaint Management System — অটোমেটিক নোটিফিকেশন</p>
  </td></tr>
  <tr><td style="height:24px;"></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// ── Satisfaction survey email ──────────────────────────────────────────────────
const generateSatisfactionEmail = (complaint) => {
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"/><title>আপনার মতামত দিন — BeeHarvest</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:24px 24px 0 0;padding:40px;text-align:center;">
    <div style="font-size:48px;margin-bottom:12px;">⭐</div>
    <h1 style="margin:0 0 10px;color:white;font-size:24px;font-weight:800;">আপনার মতামত দিন</h1>
    <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;">আপনার অভিযোগ সমাধান হয়েছে। আমাদের সেবা কেমন ছিল?</p>
  </td></tr>
  <tr><td style="background:#FFF9F0;padding:32px;">
    <p style="margin:0 0 24px;font-size:15px;color:#374151;text-align:center;">টিকেট <strong style="color:#F5A623;font-family:monospace;">${complaint.ticketNumber}</strong> এর জন্য রেটিং দিন:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        ${[1, 2, 3, 4, 5].map((n) => `<td style="padding:0 6px;"><a href="${shopUrl}/rate?ticket=${complaint.ticketNumber}&score=${n}" style="display:inline-block;width:52px;height:52px;background:${n <= 3 ? "#FEF2F2" : "#ECFDF5"};border-radius:12px;text-align:center;line-height:52px;font-size:28px;text-decoration:none;">${n === 1 ? "😡" : n === 2 ? "😞" : n === 3 ? "😐" : n === 4 ? "😊" : "🤩"}</a></td>`).join("")}
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7A99;text-align:center;">আপনার মতামত আমাদের সেবা উন্নত করতে সাহায্য করে</p>
  </td></tr>
  <tr><td style="background:#0D1B3E;border-radius:0 0 24px 24px;padding:20px;text-align:center;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">© ${new Date().getFullYear()} BeeHarvest</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

// ── Helper: send + log ────────────────────────────────────────────────────────
const sendAndLog = async (complaint, type, recipient, subject, html) => {
  let success = false;
  try {
    const result = await sendEmail(recipient, subject, html);
    success = !!(result && result.success);
    if (success) console.log(`✅ [COMPLAINT EMAIL] ${type} → ${recipient}`);
    else console.error(`❌ [COMPLAINT EMAIL] ${type} failed → ${recipient}`);
  } catch (err) {
    console.error(`❌ [COMPLAINT EMAIL] ${type} crashed:`, err.message);
  }
  // Log on the document (non-blocking; ignore save error)
  try {
    await Complaint.findByIdAndUpdate(complaint._id, {
      $push: { emailsSent: { type, recipient, success, sentAt: new Date() } },
    });
  } catch (_) {}
  return success;
};

// ── Anti-spam rate check ──────────────────────────────────────────────────────
const SPAM_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SPAM_MAX = 3; // max 3 complaints per IP per hour

const checkSpam = async (ipAddress, email) => {
  const since = new Date(Date.now() - SPAM_WINDOW_MS);
  const count = await Complaint.countDocuments({
    $or: [{ ipAddress }, { "customer.email": email }],
    createdAt: { $gte: since },
  });
  return count >= SPAM_MAX;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ██ CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── @route  POST /api/complaints
// ── @access Public (customer)
const createComplaint = async (req, res) => {
  try {
    console.log("📋 [COMPLAINT] New complaint received");

    const { customer, category, subject, description, orderNumber } = req.body;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!customer?.name || !customer?.email) {
      return res
        .status(400)
        .json({ success: false, message: "নাম ও ইমেইল আবশ্যক" });
    }
    if (!category || !subject || !description) {
      return res
        .status(400)
        .json({ success: false, message: "বিভাগ, বিষয় ও বিবরণ আবশ্যক" });
    }
    if (description.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "অভিযোগের বিবরণ কমপক্ষে ২০ অক্ষর হতে হবে",
      });
    }

    // ── Phone format check ───────────────────────────────────────────────────
    if (customer.phone) {
      const clean = customer.phone.replace(/\D/g, "");
      if (!/^01[3-9]\d{8}$/.test(clean)) {
        return res
          .status(400)
          .json({ success: false, message: "বৈধ বাংলাদেশি ফোন নম্বর দিন" });
      }
      customer.phone = clean;
    }

    // ── Rate-limit / spam guard ──────────────────────────────────────────────
    const ipAddress =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const isSpam = await checkSpam(ipAddress, customer.email);
    if (isSpam) {
      return res.status(429).json({
        success: false,
        message: "অনেক বেশি অভিযোগ করা হয়েছে। ১ ঘণ্টা পর আবার চেষ্টা করুন।",
        code: "RATE_LIMIT_COMPLAINT",
      });
    }

    // ── Verify order if given ─────────────────────────────────────────────────
    let orderId = null;
    let verifiedOrderNumber = null;

    if (orderNumber && orderNumber.trim()) {
      const order = await Order.findOne({
        orderNumber: orderNumber.trim().toUpperCase(),
        "customer.email": customer.email.toLowerCase(),
      }).select("_id orderNumber");

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "অর্ডার নম্বরটি আপনার ইমেইলের সাথে মেলেনি। অর্ডার নম্বর ছাড়াও অভিযোগ করতে পারেন।",
        });
      }
      orderId = order._id;
      verifiedOrderNumber = order.orderNumber;
    }

    // ── Create complaint ─────────────────────────────────────────────────────
    const complaint = await Complaint.create({
      customer: {
        name: customer.name.trim(),
        email: customer.email.toLowerCase().trim(),
        phone: customer.phone || undefined,
      },
      category,
      subject: subject.trim(),
      description: description.trim(),
      orderNumber: verifiedOrderNumber,
      orderId,
      ipAddress,
      userAgent: req.headers["user-agent"] || "",
    });

    console.log(
      `✅ [COMPLAINT] Created: ${complaint.ticketNumber} | priority: ${complaint.priority}`,
    );

    // ── Send emails in background ────────────────────────────────────────────
    if (process.env.DISABLE_EMAIL !== "true") {
      setImmediate(async () => {
        await sendAndLog(
          complaint,
          "confirmation",
          complaint.customer.email,
          `✅ অভিযোগ নিবন্ধন নিশ্চিত — ${complaint.ticketNumber}`,
          generateComplaintConfirmationEmail(complaint),
        );

        const adminEmails = (process.env.ADMIN_EMAILS || "ygstudiobd@gmail.com")
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

        for (const email of adminEmails) {
          await sendAndLog(
            complaint,
            "admin_new",
            email,
            `🆕 নতুন অভিযোগ [${complaint.priority.toUpperCase()}] — ${complaint.ticketNumber}`,
            generateAdminComplaintEmail(complaint),
          );
        }
      });
    }

    res.status(201).json({
      success: true,
      message: "আপনার অভিযোগটি সফলভাবে দাখিল করা হয়েছে।",
      data: {
        ticketNumber: complaint.ticketNumber,
        priority: complaint.priority,
        status: complaint.status,
        category: complaint.category,
        createdAt: complaint.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ [COMPLAINT] Create error:", error.message);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({
      success: false,
      message: "অভিযোগ দাখিল করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
    });
  }
};

// ── @route  GET /api/complaints
// ── @access Private (admin)
const getComplaints = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 15, 50);
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.category) query.category = req.query.category;
    if (req.query.flagged === "true") query.isFlagged = true;

    if (req.query.search) {
      query.$or = [
        { ticketNumber: { $regex: req.query.search, $options: "i" } },
        { "customer.name": { $regex: req.query.search, $options: "i" } },
        { "customer.email": { $regex: req.query.search, $options: "i" } },
        { "customer.phone": { $regex: req.query.search, $options: "i" } },
        { orderNumber: { $regex: req.query.search, $options: "i" } },
        { subject: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom)
        query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .select(
          "ticketNumber customer category subject status priority orderNumber createdAt isFlagged replies resolution",
        )
        .sort(
          req.query.sort === "priority"
            ? { priority: -1, createdAt: -1 }
            : "-createdAt",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: complaints,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("❌ [COMPLAINT] Get list error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/complaints/stats
// ── @access Private (admin)
const getComplaintStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      open,
      underReview,
      onHold,
      escalated,
      resolved,
      rejected,
      closed,
      todayCount,
      weekCount,
      urgent,
      byCategory,
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: "open" }),
      Complaint.countDocuments({ status: "under_review" }),
      Complaint.countDocuments({ status: "on_hold" }),
      Complaint.countDocuments({ status: "escalated" }),
      Complaint.countDocuments({ status: "resolved" }),
      Complaint.countDocuments({ status: "rejected" }),
      Complaint.countDocuments({ status: "closed" }),
      Complaint.countDocuments({ createdAt: { $gte: today } }),
      Complaint.countDocuments({ createdAt: { $gte: weekAgo } }),
      Complaint.countDocuments({
        priority: "urgent",
        status: { $nin: ["resolved", "rejected", "closed"] },
      }),
      Complaint.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        open,
        underReview,
        onHold,
        escalated,
        resolved,
        rejected,
        closed,
        todayCount,
        weekCount,
        urgent,
        byCategory,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/complaints/:id
// ── @access Private (admin)
const getComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate(
      "orderId",
      "orderNumber total orderStatus customer",
    );
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });
    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/complaints/track/:ticketNumber
// ── @access Public (customer)
const trackComplaint = async (req, res) => {
  try {
    const ticketNumber = req.params.ticketNumber.trim().toUpperCase();
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "ইমেইল আবশ্যক" });
    }

    const complaint = await Complaint.findOne({
      ticketNumber,
      "customer.email": email.toLowerCase().trim(),
    }).select(
      "-ipAddress -userAgent -internalNotes -isFlagged -flagReason -emailsSent -statusHistory",
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message:
          "টিকেট পাওয়া যায়নি। অনুগ্রহ করে সঠিক টিকেট নম্বর ও ইমেইল দিন।",
      });
    }

    // Filter out internal (admin-only) replies
    const safeComplaint = complaint.toObject();
    safeComplaint.replies = safeComplaint.replies.filter((r) => !r.isInternal);

    res.json({ success: true, data: safeComplaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/complaints/my
// ── @access Public (customer — by email/phone)
const getMyComplaints = async (req, res) => {
  try {
    const { email, phone } = req.query;
    if (!email && !phone) {
      return res
        .status(400)
        .json({ success: false, message: "ইমেইল অথবা ফোন নম্বর আবশ্যক" });
    }

    const query = {};
    if (email) query["customer.email"] = email.toLowerCase().trim();
    if (phone) {
      const clean = phone.replace(/\D/g, "");
      if (!/^01[3-9]\d{8}$/.test(clean)) {
        return res
          .status(400)
          .json({ success: false, message: "বৈধ বাংলাদেশি ফোন নম্বর দিন" });
      }
      query["customer.phone"] = clean;
    }

    const complaints = await Complaint.find(query)
      .select(
        "ticketNumber category subject status priority createdAt resolution.resolvedAt",
      )
      .sort("-createdAt")
      .limit(20)
      .lean();

    res.json({ success: true, count: complaints.length, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PATCH /api/complaints/:id/status
// ── @access Private (admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, reason, message: adminMessage } = req.body;
    const validStatuses = [
      "open",
      "under_review",
      "on_hold",
      "escalated",
      "resolved",
      "rejected",
      "closed",
    ];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "অবৈধ স্ট্যাটাস" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });

    const oldStatus = complaint.status;
    complaint.statusHistory.push({
      from: oldStatus,
      to: status,
      reason,
      changedBy: req.user?.email || "admin",
    });
    complaint.status = status;

    if (status === "on_hold" && reason) complaint.holdReason = reason;
    if (status === "resolved") {
      complaint.resolvedAt = new Date();
      complaint.resolution = complaint.resolution || {};
      complaint.resolution.resolvedAt = new Date();
      complaint.resolution.resolvedBy = req.user?.email || "admin";
    }
    if (!complaint.firstResponseAt && oldStatus === "open") {
      complaint.firstResponseAt = new Date();
    }

    await complaint.save();

    console.log(
      `✅ [COMPLAINT] ${complaint.ticketNumber}: ${oldStatus} → ${status}`,
    );

    res.json({
      success: true,
      data: complaint,
      message: `স্ট্যাটাস আপডেট হয়েছে: ${status}`,
    });

    // Background email
    if (oldStatus !== status && process.env.DISABLE_EMAIL !== "true") {
      setImmediate(async () => {
        await sendAndLog(
          complaint,
          `status_${status}`,
          complaint.customer.email,
          `📦 আপনার অভিযোগ আপডেট — ${complaint.ticketNumber}`,
          generateStatusUpdateEmail(complaint, adminMessage || ""),
        );
        // After resolve → send satisfaction survey
        if (status === "resolved") {
          setTimeout(
            async () => {
              await sendAndLog(
                complaint,
                "satisfaction_survey",
                complaint.customer.email,
                `⭐ আপনার মতামত দিন — ${complaint.ticketNumber}`,
                generateSatisfactionEmail(complaint),
              );
            },
            2 * 60 * 60 * 1000,
          ); // 2 hours later
        }
      });
    }
  } catch (error) {
    console.error("❌ [COMPLAINT] Status update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/complaints/:id/resolve
// ── @access Private (admin)
const resolveComplaint = async (req, res) => {
  try {
    const { type, details, couponCode, refundAmount } = req.body;
    if (!type || !details) {
      return res
        .status(400)
        .json({ success: false, message: "সমাধানের ধরন ও বিবরণ আবশ্যক" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });
    if (complaint.status === "resolved") {
      return res
        .status(400)
        .json({ success: false, message: "অভিযোগটি ইতিমধ্যে সমাধান হয়েছে" });
    }

    const oldStatus = complaint.status;
    complaint.status = "resolved";
    complaint.resolvedAt = new Date();
    complaint.resolution = {
      type,
      details,
      couponCode: couponCode || undefined,
      refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
      resolvedAt: new Date(),
      resolvedBy: req.user?.email || "admin",
    };
    complaint.statusHistory.push({
      from: oldStatus,
      to: "resolved",
      changedBy: req.user?.email || "admin",
    });

    // Add internal reply
    complaint.replies.push({
      message: `✅ সমাধান: ${details}${couponCode ? ` | কুপন: ${couponCode}` : ""}${refundAmount ? ` | রিফান্ড: ${refundAmount} ৳` : ""}`,
      authorType: "admin",
      authorName: req.user?.name || "Admin",
      isInternal: false,
      emailSent: false,
    });

    await complaint.save();

    res.json({
      success: true,
      data: complaint,
      message: "অভিযোগ সফলভাবে সমাধান হয়েছে",
    });

    if (process.env.DISABLE_EMAIL !== "true") {
      setImmediate(async () => {
        await sendAndLog(
          complaint,
          "resolved",
          complaint.customer.email,
          `✅ আপনার অভিযোগ সমাধান হয়েছে — ${complaint.ticketNumber}`,
          generateStatusUpdateEmail(complaint, details),
        );
        setTimeout(
          async () => {
            await sendAndLog(
              complaint,
              "satisfaction_survey",
              complaint.customer.email,
              `⭐ আপনার মতামত দিন — ${complaint.ticketNumber}`,
              generateSatisfactionEmail(complaint),
            );
          },
          2 * 60 * 60 * 1000,
        );
      });
    }
  } catch (error) {
    console.error("❌ [COMPLAINT] Resolve error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/complaints/:id/reject
// ── @access Private (admin)
const rejectComplaint = async (req, res) => {
  try {
    const { rejectionReason, rejectionNote } = req.body;
    if (!rejectionReason || !rejectionNote) {
      return res
        .status(400)
        .json({ success: false, message: "প্রত্যাখ্যানের কারণ আবশ্যক" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });

    const oldStatus = complaint.status;
    complaint.status = "rejected";
    complaint.rejectionReason = rejectionReason;
    complaint.rejectionNote = rejectionNote;
    complaint.statusHistory.push({
      from: oldStatus,
      to: "rejected",
      reason: rejectionNote,
      changedBy: req.user?.email || "admin",
    });

    await complaint.save();

    res.json({
      success: true,
      data: complaint,
      message: "অভিযোগ প্রত্যাখ্যান করা হয়েছে",
    });

    if (process.env.DISABLE_EMAIL !== "true") {
      setImmediate(async () => {
        await sendAndLog(
          complaint,
          "rejected",
          complaint.customer.email,
          `❌ অভিযোগ আপডেট — ${complaint.ticketNumber}`,
          generateStatusUpdateEmail(complaint, rejectionNote),
        );
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/complaints/:id/reply
// ── @access Private (admin) or Public (customer with token validation)
const addReply = async (req, res) => {
  try {
    const { message, isInternal = false, senderType = "admin" } = req.body;
    if (!message || message.trim().length < 5) {
      return res
        .status(400)
        .json({ success: false, message: "বার্তাটি কমপক্ষে ৫ অক্ষর হতে হবে" });
    }
    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "বার্তা ২০০০ অক্ষরের বেশি হতে পারবে না",
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });

    if (
      ["resolved", "rejected", "closed"].includes(complaint.status) &&
      senderType === "customer"
    ) {
      return res.status(400).json({
        success: false,
        message: "বন্ধ/সমাধানকৃত অভিযোগে উত্তর করা যাবে না",
      });
    }

    const reply = {
      message: message.trim(),
      authorType: senderType,
      authorName:
        senderType === "admin"
          ? req.user?.name || "Admin"
          : complaint.customer.name,
      isInternal: senderType === "admin" ? isInternal : false,
      emailSent: false,
    };

    complaint.replies.push(reply);

    // Auto-move to under_review when admin first replies
    if (senderType === "admin" && complaint.status === "open") {
      complaint.statusHistory.push({
        from: "open",
        to: "under_review",
        changedBy: "system",
      });
      complaint.status = "under_review";
      if (!complaint.firstResponseAt) complaint.firstResponseAt = new Date();
    }

    await complaint.save();

    // Mark last reply email as sent (update after save)
    const savedReply = complaint.replies[complaint.replies.length - 1];

    res.json({
      success: true,
      data: savedReply,
      message: "উত্তর পাঠানো হয়েছে",
    });

    // Email customer (if admin replied and not internal)
    if (
      senderType === "admin" &&
      !isInternal &&
      process.env.DISABLE_EMAIL !== "true"
    ) {
      setImmediate(async () => {
        await sendAndLog(
          complaint,
          "admin_reply",
          complaint.customer.email,
          `💬 আপনার অভিযোগে নতুন বার্তা — ${complaint.ticketNumber}`,
          generateReplyEmail(complaint, message.trim()),
        );
        await Complaint.findByIdAndUpdate(complaint._id, {
          $set: { [`replies.${complaint.replies.length - 1}.emailSent`]: true },
        });
      });
    }
  } catch (error) {
    console.error("❌ [COMPLAINT] Reply error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PATCH /api/complaints/:id/assign
// ── @access Private (admin)
const assignComplaint = async (req, res) => {
  try {
    const { assignedTo, priority } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });

    if (assignedTo !== undefined) complaint.assignedTo = assignedTo;
    if (priority) complaint.priority = priority;

    await complaint.save();
    res.json({
      success: true,
      data: complaint,
      message: "অভিযোগ আপডেট হয়েছে",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PATCH /api/complaints/:id/flag
// ── @access Private (admin)
const flagComplaint = async (req, res) => {
  try {
    const { isFlagged, flagReason } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { isFlagged, flagReason: isFlagged ? flagReason : undefined },
      { new: true },
    );
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });
    res.json({
      success: true,
      data: complaint,
      message: isFlagged ? "ফ্ল্যাগ করা হয়েছে" : "ফ্ল্যাগ সরানো হয়েছে",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/complaints/:id/satisfaction
// ── @access Public (customer)
const submitSatisfaction = async (req, res) => {
  try {
    const { score, feedback, ticketNumber, email } = req.body;
    if (!score || score < 1 || score > 5) {
      return res
        .status(400)
        .json({ success: false, message: "রেটিং ১–৫ এর মধ্যে হতে হবে" });
    }

    const complaint = await Complaint.findOneAndUpdate(
      {
        ticketNumber: ticketNumber.toUpperCase(),
        "customer.email": email.toLowerCase(),
        status: "resolved",
      },
      {
        "satisfactionRating.score": parseInt(score),
        "satisfactionRating.feedback": feedback || "",
        "satisfactionRating.ratedAt": new Date(),
      },
      { new: true },
    );

    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "টিকেট পাওয়া যায়নি" });

    res.json({ success: true, message: "আপনার মতামতের জন্য ধন্যবাদ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  DELETE /api/complaints/:id
// ── @access Private (admin)
const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res
        .status(404)
        .json({ success: false, message: "অভিযোগ পাওয়া যায়নি" });
    await complaint.deleteOne();
    res.json({ success: true, message: "অভিযোগ মুছে ফেলা হয়েছে" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  POST /api/complaints/bulk-action
// ── @access Private (admin)
const bulkAction = async (req, res) => {
  try {
    const { ids, action, reason } = req.body;
    if (!ids || !ids.length || !action) {
      return res
        .status(400)
        .json({ success: false, message: "IDs ও action আবশ্যক" });
    }
    if (ids.length > 50) {
      return res.status(400).json({
        success: false,
        message: "একসাথে সর্বোচ্চ ৫০টি অভিযোগ প্রক্রিয়া করা যাবে",
      });
    }

    const validActions = {
      close: "closed",
      resolve: "resolved",
      reject: "rejected",
    };
    if (!validActions[action]) {
      return res.status(400).json({ success: false, message: "অবৈধ action" });
    }

    const result = await Complaint.updateMany(
      { _id: { $in: ids } },
      {
        $set: { status: validActions[action] },
        $push: {
          statusHistory: {
            from: "bulk",
            to: validActions[action],
            reason: reason || "bulk action",
            changedBy: req.user?.email || "admin",
          },
        },
      },
    );

    res.json({
      success: true,
      message: `${result.modifiedCount}টি অভিযোগ আপডেট হয়েছে`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintStats,
  getComplaint,
  trackComplaint,
  getMyComplaints,
  updateComplaintStatus,
  resolveComplaint,
  rejectComplaint,
  addReply,
  assignComplaint,
  flagComplaint,
  submitSatisfaction,
  deleteComplaint,
  bulkAction,
};
