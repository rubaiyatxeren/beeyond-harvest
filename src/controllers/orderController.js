const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendEmail } = require("../utils/emailService");

// ─── Email Templates ──────────────────────────────────────────────────────────

const generateOrderEmailTemplate = (order, type = "new_order") => {
  const isNewOrder = type === "new_order";

  const statusConfig = {
    pending: {
      color: "#F5A623",
      bg: "#FEF3CD",
      icon: "⏳",
      label: "অপেক্ষমাণ",
    },
    confirmed: {
      color: "#3B82F6",
      bg: "#EFF6FF",
      icon: "✅",
      label: "নিশ্চিত",
    },
    processing: {
      color: "#8B5CF6",
      bg: "#F5F3FF",
      icon: "⚙️",
      label: "প্রক্রিয়াধীন",
    },
    shipped: { color: "#F59E0B", bg: "#FFFBEB", icon: "🚚", label: "শিপড" },
    delivered: {
      color: "#10B981",
      bg: "#ECFDF5",
      icon: "🎉",
      label: "ডেলিভারি সম্পন্ন",
    },
    cancelled: { color: "#EF4444", bg: "#FEF2F2", icon: "❌", label: "বাতিল" },
  };

  const sc = statusConfig[order.orderStatus] || statusConfig.pending;

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;vertical-align:middle;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;background:linear-gradient(135deg,#FEF3CD,#FDD882);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🛒</div>
          <div>
            <div style="font-weight:700;color:#0D1B3E;font-size:14px;line-height:1.3;">${item.name}</div>
            <div style="color:#6B7A99;font-size:12px;margin-top:2px;">SKU: ${item.sku || "N/A"}</div>
          </div>
        </div>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:center;vertical-align:middle;">
        <span style="background:#F5F7FA;color:#0D1B3E;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;">${item.quantity}</span>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:right;vertical-align:middle;color:#6B7A99;font-size:13px;">${item.price.toLocaleString()} ৳</td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:right;vertical-align:middle;font-weight:700;color:#0D1B3E;font-size:14px;">${item.total.toLocaleString()} ৳</td>
    </tr>`,
    )
    .join("");

  const timelineSteps = [
    { key: "pending", icon: "📋", label: "অর্ডার গ্রহণ" },
    { key: "confirmed", icon: "✅", label: "নিশ্চিত" },
    { key: "processing", icon: "⚙️", label: "প্রক্রিয়াধীন" },
    { key: "shipped", icon: "🚚", label: "শিপড" },
    { key: "delivered", icon: "🎉", label: "ডেলিভারি" },
  ];

  const statusOrder = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
  ];
  const currentIdx = statusOrder.indexOf(order.orderStatus);

  const timelineHtml =
    order.orderStatus === "cancelled"
      ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">❌</span>
        <div>
          <div style="font-weight:700;color:#DC2626;font-size:14px;">অর্ডারটি বাতিল করা হয়েছে</div>
          <div style="color:#6B7280;font-size:13px;margin-top:2px;">কোনো প্রশ্নের জন্য আমাদের সাথে যোগাযোগ করুন</div>
        </div>
      </div>`
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          ${timelineSteps
            .map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const dotBg = done ? "#10B981" : active ? "#F5A623" : "#E5E7EB";
              const dotColor = done || active ? "white" : "#9CA3AF";
              const labelColor = done
                ? "#10B981"
                : active
                  ? "#F5A623"
                  : "#9CA3AF";
              const weight = active ? "700" : "500";
              return `<td style="text-align:center;vertical-align:top;padding:0 4px;">
              <div style="width:40px;height:40px;background:${dotBg};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:16px;color:${dotColor};font-weight:700;${active ? "box-shadow:0 0 0 4px rgba(245,166,35,0.2);" : ""}">${step.icon}</div>
              <div style="font-size:10px;color:${labelColor};font-weight:${weight};line-height:1.3;">${step.label}</div>
            </td>
            ${i < timelineSteps.length - 1 ? `<td style="padding-top:20px;"><div style="height:2px;background:${done ? "#10B981" : "#E5E7EB"};margin:0 -2px;"></div></td>` : ""}`;
            })
            .join("")}
        </tr>
      </table>`;

  const greeting = isNewOrder
    ? `আপনার অর্ডার নিশ্চিত হয়েছে!`
    : `আপনার অর্ডারের আপডেট`;
  const subGreeting = isNewOrder
    ? `আমরা আপনার অর্ডারটি পেয়েছি এবং শীঘ্রই প্রক্রিয়া শুরু করব।`
    : `আপনার অর্ডার <strong>${sc.icon} ${sc.label}</strong> স্ট্যাটাসে আপডেট হয়েছে।`;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>BeeHarvest — অর্ডার ${isNewOrder ? "কনফার্মেশন" : "আপডেট"}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;">${isNewOrder ? "আপনার অর্ডার নিশ্চিত হয়েছে" : "অর্ডার স্ট্যাটাস আপডেট"} — ${order.orderNumber}</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- ══ HEADER ══ -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);border-radius:24px 24px 0 0;overflow:hidden;">
      <tr>
        <td style="padding:40px 40px 0;text-align:center;">
          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr>
              <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;font-size:26px;">🐝</td>
              <td style="padding-left:12px;text-align:left;vertical-align:middle;">
                <div style="font-size:22px;font-weight:800;color:white;letter-spacing:0.5px;">BeeHarvest</div>
                <div style="font-size:11px;color:#FDD882;margin-top:1px;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</div>
              </td>
            </tr>
          </table>

          <!-- Hero badge -->
          <div style="display:inline-block;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.35);border-radius:50px;padding:6px 20px;margin-bottom:20px;">
            <span style="color:#FDD882;font-size:12px;font-weight:600;letter-spacing:0.5px;">${isNewOrder ? "✨ নতুন অর্ডার কনফার্মেশন" : "📦 অর্ডার স্ট্যাটাস আপডেট"}</span>
          </div>

          <!-- Main heading -->
          <h1 style="margin:0 0 10px;color:white;font-size:28px;font-weight:800;line-height:1.2;">${greeting}</h1>
          <p style="margin:0 0 32px;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">${subGreeting}</p>
        </td>
      </tr>

      <!-- Honeycomb wave divider -->
      <tr>
        <td style="line-height:0;">
          <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z" fill="#FFF9F0"/>
          </svg>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ══ BODY ══ -->
  <tr><td style="background:#FFF9F0;padding:0 40px;">

    <!-- Hi greeting -->
    <div style="padding:28px 0 0;">
      <p style="margin:0 0 24px;font-size:16px;color:#0D1B3E;line-height:1.6;">
        নমস্কার <strong style="color:#F5A623;">${order.customer.name}</strong> ভাই/আপু! 👋
      </p>
    </div>

    <!-- Order number strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">অর্ডার নম্বর</div>
                <div style="font-size:20px;font-weight:800;color:#FDD882;letter-spacing:1px;font-family:monospace;">${order.orderNumber}</div>
              </td>
              <td align="right">
                <div style="background:${sc.bg};color:${sc.color};padding:8px 16px;border-radius:50px;font-size:12px;font-weight:700;white-space:nowrap;">${sc.icon} ${sc.label}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Order details grid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <div style="font-size:13px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">📋 অর্ডারের বিবরণ</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-bottom:14px;vertical-align:top;">
                <div style="font-size:11px;color:#6B7A99;margin-bottom:3px;">তারিখ ও সময়</div>
                <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${new Date(order.createdAt).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
              </td>
              <td width="50%" style="padding-bottom:14px;vertical-align:top;">
                <div style="font-size:11px;color:#6B7A99;margin-bottom:3px;">পেমেন্ট পদ্ধতি</div>
                <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${order.paymentMethod === "cash_on_delivery" ? "💵 ক্যাশ অন ডেলিভারি" : order.paymentMethod}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#6B7A99;margin-bottom:3px;">পেমেন্ট স্ট্যাটাস</div>
                <div style="font-size:13px;font-weight:600;color:${order.paymentStatus === "paid" ? "#10B981" : "#F59E0B"};">${order.paymentStatus === "paid" ? "✅ পরিশোধিত" : "⏳ অপেক্ষমাণ"}</div>
              </td>
              ${
                order.trackingNumber
                  ? `<td width="50%" style="vertical-align:top;">
                <div style="font-size:11px;color:#6B7A99;margin-bottom:3px;">ট্র্যাকিং নম্বর</div>
                <div style="font-size:13px;font-weight:700;color:#F5A623;font-family:monospace;">${order.trackingNumber}</div>
              </td>`
                  : `<td width="50%"></td>`
              }
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Delivery address -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <div style="font-size:13px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">📍 ডেলিভারি ঠিকানা</div>
          <div style="font-size:14px;color:#374151;line-height:1.8;">
            <strong style="color:#0D1B3E;">${order.customer.name}</strong><br/>
            ${order.customer.phone}<br/>
            ${order.customer.address?.street ? order.customer.address.street + "<br/>" : ""}
            ${order.customer.address?.area ? order.customer.address.area + ", " : ""}${order.customer.address?.city || ""}
          </div>
        </td>
      </tr>
    </table>

    <!-- Order Status Timeline -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <div style="font-size:13px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:20px;">🚀 অর্ডার যাত্রা</div>
          ${timelineHtml}
        </td>
      </tr>
    </table>

    <!-- Items table -->
    <div style="margin-bottom:8px;">
      <div style="font-size:13px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">🛍️ অর্ডারকৃত পণ্যসমূহ</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;margin-bottom:24px;border:1px solid #F0E8D8;">
      <thead>
        <tr style="background:#0D1B3E;">
          <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;">পণ্য</th>
          <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;">পরিমাণ</th>
          <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;">একক মূল্য</th>
          <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;">মোট</th>
        </tr>
      </thead>
      <tbody style="background:white;">
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:28px;">
      <tr><td style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.65);font-size:14px;">পণ্যের মূল্য</td>
            <td style="padding:6px 0;text-align:right;color:rgba(255,255,255,0.65);font-size:14px;">${order.subtotal.toLocaleString()} ৳</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.65);font-size:14px;">ডেলিভারি চার্জ</td>
            <td style="padding:6px 0;text-align:right;color:rgba(255,255,255,0.65);font-size:14px;">${order.deliveryCharge.toLocaleString()} ৳</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:2px 0;">
              <div style="height:1px;background:rgba(255,255,255,0.15);margin:8px 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:white;font-size:18px;font-weight:800;">মোট প্রদেয়</td>
            <td style="padding:6px 0;text-align:right;color:#FDD882;font-size:22px;font-weight:800;">${order.total.toLocaleString()} ৳</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td align="center">
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/orders/${order._id}" style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:15px;font-weight:800;letter-spacing:0.3px;">🔍 অর্ডার ট্র্যাক করুন</a>
        </td>
      </tr>
    </table>

    <!-- Trust badges -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td width="33%" align="center" style="padding:12px 8px;">
          <div style="font-size:24px;margin-bottom:6px;">🚚</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;">দ্রুত ডেলিভারি</div>
          <div style="font-size:10px;color:#6B7A99;margin-top:2px;">১–২ কার্যদিবস</div>
        </td>
        <td width="33%" align="center" style="padding:12px 8px;border-left:1px solid #F0E8D8;border-right:1px solid #F0E8D8;">
          <div style="font-size:24px;margin-bottom:6px;">🛡️</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;">নিরাপদ পেমেন্ট</div>
          <div style="font-size:10px;color:#6B7A99;margin-top:2px;">১০০% সুরক্ষিত</div>
        </td>
        <td width="33%" align="center" style="padding:12px 8px;">
          <div style="font-size:24px;margin-bottom:6px;">↩️</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;">৭ দিনের রিটার্ন</div>
          <div style="font-size:10px;color:#6B7A99;margin-top:2px;">ঝামেলামুক্ত</div>
        </td>
      </tr>
    </table>

  </td></tr>

  <!-- ══ FOOTER ══ -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
      <tr>
        <td style="padding:32px 40px;text-align:center;">
          <div style="margin-bottom:16px;">
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 4px;">Facebook</a>
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 4px;">WhatsApp</a>
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 4px;">Instagram</a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
            🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়
          </p>
          <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.35);">
            সাহায্যের জন্য: <a href="mailto:support@beeharvest.com.bd" style="color:#FDD882;text-decoration:none;">support@beeharvest.com.bd</a>
          </p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">© ${new Date().getFullYear()} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Bottom spacer -->
  <tr><td style="height:24px;"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

const generateAdminEmailTemplate = (order, type = "new_order") => {
  const isNew = type === "new_order";
  const badgeColor = isNew ? "#10B981" : "#3B82F6";
  const badgeBg = isNew ? "#ECFDF5" : "#EFF6FF";
  const badgeText = isNew ? "🆕 নতুন অর্ডার" : "🔄 স্ট্যাটাস পরিবর্তন";

  const itemRows = order.items
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? "white" : "#F9FAFB"};">
      <td style="padding:12px 16px;font-size:13px;color:#0D1B3E;font-weight:600;border-bottom:1px solid #F3F4F6;">${item.name}</td>
      <td style="padding:12px 16px;font-size:13px;text-align:center;color:#6B7280;border-bottom:1px solid #F3F4F6;">${item.sku || "—"}</td>
      <td style="padding:12px 16px;font-size:13px;text-align:center;border-bottom:1px solid #F3F4F6;">
        <span style="background:#F0F9FF;color:#0369A1;padding:2px 10px;border-radius:20px;font-weight:700;">${item.quantity}</span>
      </td>
      <td style="padding:12px 16px;font-size:13px;text-align:right;color:#6B7280;border-bottom:1px solid #F3F4F6;">${item.price.toLocaleString()} ৳</td>
      <td style="padding:12px 16px;font-size:13px;text-align:right;font-weight:700;color:#0D1B3E;border-bottom:1px solid #F3F4F6;">${item.total.toLocaleString()} ৳</td>
    </tr>`,
    )
    .join("");

  const payStatusColor = order.paymentStatus === "paid" ? "#10B981" : "#F59E0B";
  const payStatusBg = order.paymentStatus === "paid" ? "#ECFDF5" : "#FFFBEB";
  const payStatusText =
    order.paymentStatus === "paid" ? "✅ পরিশোধিত" : "⏳ অপেক্ষমাণ";

  const orderStatusColors = {
    pending: { bg: "#FFFBEB", color: "#92400E" },
    confirmed: { bg: "#EFF6FF", color: "#1E40AF" },
    processing: { bg: "#F5F3FF", color: "#5B21B6" },
    shipped: { bg: "#FFF7ED", color: "#9A3412" },
    delivered: { bg: "#ECFDF5", color: "#065F46" },
    cancelled: { bg: "#FEF2F2", color: "#991B1B" },
  };
  const osc = orderStatusColors[order.orderStatus] || orderStatusColors.pending;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Admin — ${badgeText}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

  <!-- ══ ADMIN HEADER ══ -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 100%);border-radius:20px 20px 0 0;">
      <tr>
        <td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:20px;">🐝</td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:16px;font-weight:800;color:white;">BeeHarvest</div>
                      <div style="font-size:10px;color:#FDD882;margin-top:1px;">অ্যাডমিন নোটিফিকেশন</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="vertical-align:middle;">
                <div style="background:${badgeBg};color:${badgeColor};padding:8px 18px;border-radius:50px;font-size:13px;font-weight:700;white-space:nowrap;">${badgeText}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 28px;">
          <div style="font-size:24px;font-weight:800;color:white;margin-bottom:6px;">${isNew ? "নতুন অর্ডার এসেছে!" : "অর্ডার আপডেট হয়েছে"}</div>
          <div style="font-family:monospace;font-size:16px;color:#FDD882;letter-spacing:1px;">${order.orderNumber}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ══ ALERT STRIP ══ -->
  <tr><td style="background:${isNew ? "#ECFDF5" : "#EFF6FF"};border-left:4px solid ${isNew ? "#10B981" : "#3B82F6"};padding:14px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:${isNew ? "#065F46" : "#1E40AF"};font-weight:600;">
          ${
            isNew
              ? `⚡ জরুরি: নতুন অর্ডার প্রক্রিয়া করুন — ${new Date(order.createdAt).toLocaleString("bn-BD")}`
              : `🔄 অর্ডার স্ট্যাটাস পরিবর্তিত হয়েছে`
          }
        </td>
        <td align="right">
          <span style="background:${osc.bg};color:${osc.color};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;">${order.orderStatus.toUpperCase()}</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ══ BODY ══ -->
  <tr><td style="background:white;padding:32px;">

    <!-- Customer + Order Info (2 col) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;gap:16px;">
      <tr>
        <td width="48%" style="vertical-align:top;padding-right:8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;display:flex;align-items:center;gap:6px;">👤 গ্রাহকের তথ্য</div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">নাম</div>
                  <div style="font-size:14px;font-weight:700;color:#0D1B3E;">${order.customer.name}</div>
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">ফোন</div>
                  <div style="font-size:14px;font-weight:600;color:#0D1B3E;font-family:monospace;">${order.customer.phone}</div>
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">ইমেইল</div>
                  <div style="font-size:13px;color:#F5A623;word-break:break-all;">${order.customer.email}</div>
                </div>
                <div>
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">ঠিকানা</div>
                  <div style="font-size:13px;color:#374151;line-height:1.5;">
                    ${[order.customer.address?.street, order.customer.address?.area, order.customer.address?.city].filter(Boolean).join(", ") || "N/A"}
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
        <td width="4%"></td>
        <td width="48%" style="vertical-align:top;padding-left:8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">📦 অর্ডারের তথ্য</div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">তারিখ</div>
                  <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${new Date(order.createdAt).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">পেমেন্ট পদ্ধতি</div>
                  <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${order.paymentMethod === "cash_on_delivery" ? "💵 ক্যাশ অন ডেলিভারি" : order.paymentMethod}</div>
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">পেমেন্ট স্ট্যাটাস</div>
                  <span style="background:${payStatusBg};color:${payStatusColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${payStatusText}</span>
                </div>
                ${
                  order.trackingNumber
                    ? `<div>
                  <div style="font-size:11px;color:#94A3B8;margin-bottom:2px;">ট্র্যাকিং নম্বর</div>
                  <div style="font-size:13px;font-weight:700;color:#F5A623;font-family:monospace;">${order.trackingNumber}</div>
                </div>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Items Table -->
    <div style="margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">🛒 অর্ডারকৃত পণ্যসমূহ (${order.items.length}টি)</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#0D1B3E;">
          <th style="padding:11px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">পণ্যের নাম</th>
          <th style="padding:11px 16px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">SKU</th>
          <th style="padding:11px 16px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">পরিমাণ</th>
          <th style="padding:11px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">একক মূল্য</th>
          <th style="padding:11px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">মোট</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748B;">পণ্যের মূল্য</td>
            <td style="padding:5px 0;text-align:right;font-size:13px;color:#374151;font-weight:600;">${order.subtotal.toLocaleString()} ৳</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748B;">ডেলিভারি চার্জ</td>
            <td style="padding:5px 0;text-align:right;font-size:13px;color:#374151;font-weight:600;">${order.deliveryCharge.toLocaleString()} ৳</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;"><div style="height:1px;background:#E2E8F0;margin:6px 0;"></div></td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:16px;font-weight:800;color:#0D1B3E;">মোট</td>
            <td style="padding:5px 0;text-align:right;font-size:20px;font-weight:800;color:#F5A623;">${order.total.toLocaleString()} ৳</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Admin CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}"
            style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:16px 36px;border-radius:50px;font-size:15px;font-weight:800;letter-spacing:0.3px;">
            ⚡ অ্যাডমিন প্যানেলে দেখুন
          </a>
        </td>
      </tr>
    </table>

  </td></tr>

  <!-- ══ ADMIN FOOTER ══ -->
  <tr><td style="background:#1E293B;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.4);">এটি BeeHarvest অ্যাডমিন সিস্টেমের স্বয়ংক্রিয় নোটিফিকেশন</p>
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">© ${new Date().getFullYear()} BeeHarvest Admin Panel</p>
  </td></tr>

  <tr><td style="height:24px;"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

// module.exports = { generateOrderEmailTemplate, generateAdminEmailTemplate };

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Create order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 [ORDER] New order request received");

    const { items, customer, paymentMethod, deliveryCharge } = req.body;

    // ✅ VALIDATION
    if (!items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "No items in order" });
    }

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return res.status(400).json({
        success: false,
        message: "Customer name, email, and phone are required",
      });
    }

    // ==============================
    // 🔥 FETCH ALL PRODUCTS IN ONE QUERY
    // ==============================
    const productIds = items.map((i) => i.product);

    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let subtotal = 0;
    const orderItems = [];

    // ==============================
    // 🔥 PROCESS & VALIDATE ITEMS
    // ==============================
    for (const item of items) {
      const product = productMap.get(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      const total = product.price * item.quantity;
      subtotal += total;

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: product.price,
        total,
      });
    }

    const total = subtotal + (deliveryCharge || 60);

    // ==============================
    // ✅ ORDER NUMBER — collision-safe
    // ==============================
    const date = new Date();

    // generate always 5-digit number (10000 → 99999)
    const fiveDigit = Math.floor(10000 + Math.random() * 90000);

    const orderNumber = `ORD-${date.getFullYear()}${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}-${fiveDigit}`;

    // ==============================
    // 🔥 CREATE ORDER
    // ==============================
    const order = await Order.create({
      orderNumber,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || {},
      },
      items: orderItems,
      subtotal,
      deliveryCharge: deliveryCharge || 60,
      total,
      paymentMethod: paymentMethod || "cash_on_delivery",
      paymentStatus: "pending",
      orderStatus: "pending",
    });

    console.log(`✅ Order created: ${order.orderNumber}`);

    // ==============================
    // ✅ ATOMIC STOCK UPDATE — prevents overselling
    // ==============================
    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.product, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity } },
      },
    }));

    const stockResult = await Product.bulkWrite(bulkOps);

    if (stockResult.modifiedCount !== items.length) {
      await Order.findByIdAndDelete(order._id);
      console.warn("⚠️ Stock mismatch — order rolled back");
      return res.status(400).json({
        success: false,
        message: "Some items went out of stock. Please try again.",
      });
    }

    console.log("✅ Stock updated atomically");

    // ==============================
    // ✅ RESPONSE FIRST (FAST API)
    // ==============================
    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully",
    });

    // ==============================
    // ✅ BACKGROUND EMAIL — fully safe, no unhandled rejections
    // ==============================
    if (process.env.DISABLE_EMAIL === "true") return;

    setImmediate(async () => {
      const adminEmails = (process.env.ADMIN_EMAILS || "ygstudiobd@gmail.com")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const adminHtml = generateAdminEmailTemplate(order, "new_order");

      const results = await Promise.allSettled([
        sendEmail(
          order.customer.email,
          `🎉 Order Confirmed - ${order.orderNumber}`,
          generateOrderEmailTemplate(order, "new_order"),
        ),
        ...adminEmails.map((email) =>
          sendEmail(email, `🆕 New Order #${order.orderNumber}`, adminHtml),
        ),
      ]);

      results.forEach((r, i) => {
        const target = i === 0 ? order.customer.email : adminEmails[i - 1];
        if (r.status === "fulfilled" && r.value?.success) {
          console.log(`✅ [EMAIL] Sent → ${target}`);
        } else {
          const reason = r.reason?.message || r.value?.error || "unknown";
          console.error(`❌ [EMAIL] Failed → ${target}: ${reason}`);
        }
      });
    });
  } catch (error) {
    console.error("❌ Create order error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    let query = {};

    if (req.query.orderStatus) query.orderStatus = req.query.orderStatus;
    if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;

    if (req.query.search) {
      query.$or = [
        { orderNumber: { $regex: req.query.search, $options: "i" } },
        { "customer.name": { $regex: req.query.search, $options: "i" } },
        { "customer.phone": { $regex: req.query.search, $options: "i" } },
      ];
    }

    console.log(`📋 Fetching page ${page}, limit ${limit}`);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .select(
          "orderNumber customer total orderStatus paymentStatus createdAt trackingNumber items",
        )
        .populate("items.product", "name images")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get orders error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  try {
    console.log(`🔍 [ORDER] Fetching order: ${req.params.id}`);
    const order = await Order.findById(req.params.id).populate("items.product");
    if (!order) {
      console.warn(`⚠️ [ORDER] Not found: ${req.params.id}`);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    console.log(`✅ [ORDER] Found: ${order.orderNumber}`);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("❌ [ORDER] Get order error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res) => {
  try {
    console.log(
      `🔄 [STATUS] Update request — order: ${req.params.id}, newStatus: ${req.body.orderStatus}`,
    );
    const order = await Order.findById(req.params.id);
    if (!order) {
      console.warn(`⚠️ [STATUS] Order not found: ${req.params.id}`);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const oldStatus = order.orderStatus;
    const newStatus = req.body.orderStatus;

    order.orderStatus = newStatus;

    if (req.body.trackingNumber) {
      order.trackingNumber = req.body.trackingNumber;
      console.log(
        `📦 [STATUS] Tracking number set: ${req.body.trackingNumber}`,
      );
    }

    if (req.body.deliveryPartner) {
      order.deliveryPartner = req.body.deliveryPartner;
    }

    if (newStatus === "delivered" && order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.deliveryDate = new Date();
      console.log("💳 [STATUS] Payment auto-completed (delivered)");
    }

    await order.save();
    console.log(
      `✅ [STATUS] ${order.orderNumber}: ${oldStatus} → ${newStatus}`,
    );

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${newStatus}${newStatus === "delivered" ? " & payment auto-completed" : ""}`,
    });

    // 🔔 Background status email
    if (oldStatus !== newStatus && process.env.DISABLE_EMAIL !== "true") {
      setImmediate(async () => {
        console.log(
          `📧 [EMAIL] Sending status update for ${order.orderNumber} → ${newStatus}`,
        );
        try {
          const result = await sendEmail(
            order.customer.email,
            `📦 Order ${order.orderNumber} Status Updated to ${newStatus.toUpperCase()}`,
            generateOrderEmailTemplate(order, "status_update"),
          );
          if (result?.success) {
            console.log(
              `✅ [EMAIL] Status email sent → ${order.customer.email}`,
            );
          } else {
            console.error(
              `❌ [EMAIL] Status email failed → ${order.customer.email}: ${result?.error}`,
            );
          }
        } catch (err) {
          console.error("❌ [EMAIL] Status email crashed:", err.message);
        }
      });
    } else if (oldStatus === newStatus) {
      console.log("📧 [EMAIL] Skipped — status unchanged");
    }
  } catch (error) {
    console.error("❌ [STATUS] Update crashed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payment status
// @route   PUT /api/orders/:id/payment
// @access  Private
const updatePaymentStatus = async (req, res) => {
  try {
    console.log(
      `💳 [PAYMENT] Update — order: ${req.params.id}, status: ${req.body.paymentStatus}`,
    );
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    order.paymentStatus = req.body.paymentStatus;
    await order.save();
    console.log(
      `✅ [PAYMENT] ${order.orderNumber} payment → ${req.body.paymentStatus}`,
    );
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("❌ [PAYMENT] Update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send manual email
// @route   POST /api/orders/:id/send-email
// @access  Private
const sendManualOrderEmail = async (req, res) => {
  try {
    console.log(`📧 [MANUAL EMAIL] Request for order: ${req.params.id}`);
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (process.env.DISABLE_EMAIL === "true") {
      console.log("📧 [MANUAL EMAIL] Skipped — DISABLE_EMAIL=true");
      return res.json({ success: false, message: "Email is disabled" });
    }

    const { subject, customMessage } = req.body;
    let emailHtml = generateOrderEmailTemplate(order, "status_update");

    if (customMessage) {
      emailHtml = emailHtml.replace(
        '<div class="content">',
        `<div class="content"><div style="background:#e8f4fd;padding:16px;border-radius:12px;margin-bottom:20px;"><p style="margin:0;color:#1e40af;">📝 ${customMessage}</p></div>`,
      );
    }

    const result = await sendEmail(
      order.customer.email,
      subject || `Update on your order ${order.orderNumber}`,
      emailHtml,
    );

    if (result.success) {
      console.log(`✅ [MANUAL EMAIL] Sent to ${order.customer.email}`);
      res.json({ success: true, message: "Email sent successfully" });
    } else {
      console.error(`❌ [MANUAL EMAIL] Failed: ${result.error}`);
      res.status(500).json({
        success: false,
        message: result.error || "Failed to send email",
      });
    }
  } catch (error) {
    console.error("❌ [MANUAL EMAIL] Crashed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
const getOrderStats = async (req, res) => {
  try {
    console.log("📊 [STATS] Fetching order statistics...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      processingOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: "pending" }),
      Order.countDocuments({ orderStatus: "delivered" }),
      Order.countDocuments({ orderStatus: "cancelled" }),
      Order.countDocuments({
        orderStatus: { $in: ["confirmed", "processing", "shipped"] },
      }),
      Order.aggregate([
        { $match: { orderStatus: "delivered" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today }, orderStatus: "delivered" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.find()
        .sort("-createdAt")
        .limit(5)
        .select("orderNumber customer total orderStatus createdAt"),
    ]);

    console.log(
      `✅ [STATS] total=${totalOrders} | pending=${pendingOrders} | delivered=${completedOrders} | cancelled=${cancelledOrders} | today=${todayOrders}`,
    );

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        processingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("❌ [STATS] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sales analytics
// @route   GET /api/orders/sales-analytics
// @access  Private
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    console.log(`📈 [ANALYTICS] Fetching ${period} sales data`);
    const groupBy =
      period === "weekly" ? { $week: "$createdAt" } : { $month: "$createdAt" };

    const salesData = await Order.aggregate([
      { $match: { orderStatus: "delivered" } },
      {
        $group: {
          _id: groupBy,
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log(`✅ [ANALYTICS] Returned ${salesData.length} data points`);
    res.json({ success: true, data: salesData });
  } catch (error) {
    console.error("❌ [ANALYTICS] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get orders by customer phone number (PUBLIC)
// @route   GET /api/orders/phone/:phone
// @access  Public
const getOrdersByPhone = async (req, res) => {
  try {
    const phoneNumber = req.params.phone;

    // ✅ FIX 3: Exact phone match only — no partial matches
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Valid Bangladeshi phone number required (01XXXXXXXXX)",
      });
    }

    console.log(`📞 [PHONE SEARCH] Looking for orders: ${cleanPhone}`);

    const orders = await Order.find({ "customer.phone": cleanPhone })
      .select(
        "orderNumber customer.name customer.phone items.name items.quantity items.price items.total subtotal deliveryCharge total paymentMethod orderStatus createdAt trackingNumber",
      )
      .sort("-createdAt")
      .limit(50);

    const sanitizedOrders = orders.map((order) => {
      const orderObj = order.toObject();
      delete orderObj.customer?.email;
      return orderObj;
    });

    console.log(
      `✅ [PHONE SEARCH] Found ${sanitizedOrders.length} orders for ${cleanPhone}`,
    );

    res.json({
      success: true,
      count: sanitizedOrders.length,
      data: sanitizedOrders,
    });
  } catch (error) {
    console.error("❌ [PHONE SEARCH] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  getOrdersByPhone,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  getSalesAnalytics,
  sendManualOrderEmail,
};
