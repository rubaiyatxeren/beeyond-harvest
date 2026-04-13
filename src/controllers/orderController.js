const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendEmail } = require("../utils/emailService");
const { analyzeOrder, saveAnalysis } = require("../utils/fraudEngine");

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

  // ── Items — pure table, no flex ──────────────────────────────
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:44px;height:44px;min-width:44px;background:linear-gradient(135deg,#FEF3CD,#FDD882);border-radius:10px;text-align:center;vertical-align:middle;font-size:20px;line-height:44px;">🛒</td>
            <td style="padding-left:12px;vertical-align:middle;">
              <div style="font-weight:700;color:#0D1B3E;font-size:12px;line-height:1.4;margin:0;">${item.name}</div>
              <div style="color:#6B7A99;font-size:12px;margin:3px 0 0;">SKU: ${item.sku || "N/A"}</div>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:center;vertical-align:middle;">
        <span style="background:#F5F7FA;color:#0D1B3E;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;display:inline-block;">${item.quantity}</span>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:right;vertical-align:middle;color:#6B7A99;font-size:13px;white-space:nowrap;">${item.price.toLocaleString()} ৳</td>
      <td style="padding:14px 16px;border-bottom:1px solid #F0E8D8;text-align:right;vertical-align:middle;font-weight:700;color:#0D1B3E;font-size:14px;white-space:nowrap;">${item.total.toLocaleString()} ৳</td>
    </tr>`,
    )
    .join("");

  // ── Timeline — fixed table layout, connector via border trick ─
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
      ? `<table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:12px;padding:18px 20px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:26px;vertical-align:middle;padding-right:14px;line-height:1;">❌</td>
                <td style="vertical-align:middle;">
                  <div style="font-weight:700;color:#DC2626;font-size:14px;margin:0 0 4px;">অর্ডারটি বাতিল করা হয়েছে</div>
                  <div style="color:#6B7280;font-size:13px;margin:0;">কোনো প্রশ্নের জন্য আমাদের সাথে যোগাযোগ করুন</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
      : (() => {
          // Build each step cell + connector cell
          let cells = "";
          timelineSteps.forEach((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;

            const dotBg = done ? "#10B981" : active ? "#F5A623" : "#E8EBF4";
            const ringStyle = active
              ? "border:3px solid #F5A623;box-shadow:0 0 0 4px rgba(245,166,35,0.18);"
              : done
                ? "border:3px solid #10B981;"
                : "border:3px solid #E8EBF4;";
            const iconColor = done || active ? "#ffffff" : "#9CA3AF";
            const labelColor = done
              ? "#10B981"
              : active
                ? "#C47F11"
                : "#9CA3AF";
            const labelWeight = active ? "700" : "500";
            const connColor = done ? "#10B981" : "#E8EBF4";

            // Step cell
            cells += `<td style="text-align:center;vertical-align:top;padding:0 2px;width:${Math.floor(100 / timelineSteps.length)}%;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="width:44px;height:44px;background:${dotBg};${ringStyle}border-radius:50%;text-align:center;vertical-align:middle;font-size:18px;line-height:44px;color:${iconColor};">
                        ${step.icon}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <div style="font-size:10px;color:${labelColor};font-weight:${labelWeight};line-height:1.4;text-align:center;">${step.label}</div>
                </td>
              </tr>
            </table>
          </td>`;

            // Connector cell between steps
            if (i < timelineSteps.length - 1) {
              cells += `<td style="vertical-align:top;padding:0;padding-top:22px;width:20px;">
              <div style="height:3px;background:${connColor};border-radius:2px;margin:0 2px;"></div>
            </td>`;
            }
          });

          return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;">
          <tr>${cells}</tr>
        </table>`;
        })();

  const greeting = isNewOrder
    ? "আপনার অর্ডার নিশ্চিত হয়েছে!"
    : "আপনার অর্ডারের আপডেট";
  const subGreeting = isNewOrder
    ? "আমরা আপনার অর্ডারটি পেয়েছি এবং শীঘ্রই প্রক্রিয়া শুরু করব।"
    : `আপনার অর্ডার <strong>${sc.icon} ${sc.label}</strong> স্ট্যাটাসে আপডেট হয়েছে।`;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>BeeHarvest — অর্ডার ${isNewOrder ? "কনফার্মেশন" : "আপডেট"}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

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
              <td style="background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;font-size:26px;line-height:52px;">🐝</td>
              <td style="padding-left:12px;text-align:left;vertical-align:middle;">
                <div style="font-size:22px;font-weight:800;color:white;letter-spacing:0.5px;">BeeHarvest</div>
                <div style="font-size:11px;color:#FDD882;margin-top:2px;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</div>
              </td>
            </tr>
          </table>

          <!-- Badge -->
          <div style="display:inline-block;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.35);border-radius:50px;padding:6px 20px;margin-bottom:20px;">
            <span style="color:#FDD882;font-size:12px;font-weight:600;letter-spacing:0.5px;">${isNewOrder ? "✨ নতুন অর্ডার কনফার্মেশন" : "📦 অর্ডার স্ট্যাটাস আপডেট"}</span>
          </div>

          <h1 style="margin:0 0 10px;color:white;font-size:26px;font-weight:800;line-height:1.25;">${greeting}</h1>
          <p style="margin:0 0 32px;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">${subGreeting}</p>
        </td>
      </tr>
      <!-- Wave divider -->
      <tr>
        <td style="line-height:0;font-size:0;">
          <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z" fill="#FFF9F0"/>
          </svg>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ══ BODY ══ -->
  <tr><td style="background:#FFF9F0;padding:0 32px;">

    <!-- Greeting -->
    <div style="padding:28px 0 0;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
        প্রিয় <strong style="color:#0D1B3E;">${order.customer.name}</strong>, আপনাকে স্বাগতম! 🌟<br/>
        <span style="font-size:14px;color:#6B7A99;">আপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে। নিচে বিস্তারিত তথ্য দেওয়া হলো।</span>
      </p>
    </div>

    <!-- Order number strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:20px;">
      <tr>
        <td style="padding:18px 22px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">অর্ডার নম্বর</div>
                <div style="font-size:19px;font-weight:800;color:#FDD882;letter-spacing:1px;font-family:'Courier New',monospace;">${order.orderNumber}</div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <div style="background:${sc.bg};color:${sc.color};padding:8px 16px;border-radius:50px;font-size:12px;font-weight:700;white-space:nowrap;display:inline-block;">${sc.icon} ${sc.label}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Details grid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:20px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;">📋 অর্ডারের বিবরণ</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-bottom:12px;vertical-align:top;">
                <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px;">তারিখ</div>
                <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${new Date(order.createdAt).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
              </td>
              <td width="50%" style="padding-bottom:12px;vertical-align:top;">
                <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px;">পেমেন্ট পদ্ধতি</div>
                <div style="font-size:13px;font-weight:600;color:#0D1B3E;">${order.paymentMethod === "cash_on_delivery" ? "💵 ক্যাশ অন ডেলিভারি" : order.paymentMethod}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="vertical-align:top;">
                <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px;">পেমেন্ট স্ট্যাটাস</div>
                <div style="font-size:13px;font-weight:600;color:${order.paymentStatus === "paid" ? "#10B981" : "#F59E0B"};">${order.paymentStatus === "paid" ? "✅ পরিশোধিত" : "⏳ অপেক্ষমাণ"}</div>
              </td>
              ${
                order.trackingNumber
                  ? `<td width="50%" style="vertical-align:top;">
                    <div style="font-size:10px;color:#6B7A99;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px;">ট্র্যাকিং নম্বর</div>
                    <div style="font-size:13px;font-weight:700;color:#F5A623;font-family:'Courier New',monospace;">${order.trackingNumber}</div>
                  </td>`
                  : `<td width="50%"></td>`
              }
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Delivery address -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:20px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">📍 ডেলিভারি ঠিকানা</div>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.9;">
                <strong style="color:#0D1B3E;">${order.customer.name}</strong><br/>
                📞 ${order.customer.phone}<br/>
                ${order.customer.address?.street ? `🏠 ${order.customer.address.street}<br/>` : ""}
                📌 ${[order.customer.address?.area, order.customer.address?.city].filter(Boolean).join(", ") || "N/A"}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ── TIMELINE (fully table-based, no flex) ── -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:16px;margin-bottom:20px;">
      <tr>
        <td style="padding:18px 22px 22px;">
          <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:20px;">🚀 অর্ডার যাত্রা</div>
          ${timelineHtml}
        </td>
      </tr>
    </table>

    <!-- Items table -->
    <div style="font-size:12px;font-weight:700;color:#0D1B3E;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">🛍️ অর্ডারকৃত পণ্যসমূহ</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;margin-bottom:20px;border:1px solid #F0E8D8;">
      <thead>
        <tr style="background:#0D1B3E;">
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.8px;">পণ্য</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.8px;">পরিমাণ</th>
          <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.8px;">একক মূল্য</th>
          <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.8px;">মোট</th>
        </tr>
      </thead>
      <tbody style="background:white;">${itemsHtml}</tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A);border-radius:16px;margin-bottom:24px;">
      <tr><td style="padding:22px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:5px 0;color:rgba(255,255,255,0.6);font-size:13px;">পণ্যের মূল্য</td>
            <td style="padding:5px 0;text-align:right;color:rgba(255,255,255,0.6);font-size:13px;">${order.subtotal.toLocaleString()} ৳</td>
          </tr>
           <tr>
            <td style="padding:5px 0;color:rgba(255,255,255,0.6);font-size:13px;">ডেলিভারি চার্জ</td>
            <td style="padding:5px 0;text-align:right;color:rgba(255,255,255,0.6);font-size:13px;">${order.deliveryCharge.toLocaleString()} ৳</td>
          </tr>
          ${
            order.discount > 0
              ? `
          <tr>
            <td style="padding:5px 0;color:#86efac;font-size:13px;">🎟️ কুপন ছাড় ${order.coupon?.code ? `(${order.coupon.code})` : ""}</td>
            <td style="padding:5px 0;text-align:right;color:#86efac;font-size:13px;font-weight:700;">- ${order.discount.toLocaleString()} ৳</td>
          </tr>`
              : ""
          }
          <tr>
            <td colspan="2"><div style="height:1px;background:rgba(255,255,255,0.15);margin:10px 0;"></div></td>
          </tr>
          <tr>
            <td style="color:white;font-size:17px;font-weight:800;">মোট প্রদেয়</td>
            <td style="text-align:right;color:#FDD882;font-size:22px;font-weight:800;">${order.total.toLocaleString()} ৳</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}?track=${order.orderNumber}"
            style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);color:#0D1B3E;text-decoration:none;padding:15px 40px;border-radius:50px;font-size:15px;font-weight:800;letter-spacing:0.3px;">
            🔍 অর্ডার ট্র্যাক করুন
          </a>
        </td>
      </tr>
    </table>

    <!-- Trust badges — table-only, no flex -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #F0E8D8;border-radius:14px;overflow:hidden;">
      <tr>
        <td width="33%" align="center" style="padding:16px 8px;vertical-align:top;">
          <div style="font-size:26px;line-height:1;margin-bottom:7px;">🚚</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;margin-bottom:3px;">দ্রুত ডেলিভারি</div>
          <div style="font-size:10px;color:#6B7A99;">১–২ কার্যদিবস</div>
        </td>
        <td width="1" style="background:#F0E8D8;padding:0;"></td>
        <td width="33%" align="center" style="padding:16px 8px;vertical-align:top;">
          <div style="font-size:26px;line-height:1;margin-bottom:7px;">🛡️</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;margin-bottom:3px;">নিরাপদ পেমেন্ট</div>
          <div style="font-size:10px;color:#6B7A99;">১০০% সুরক্ষিত</div>
        </td>
        <td width="1" style="background:#F0E8D8;padding:0;"></td>
        <td width="33%" align="center" style="padding:16px 8px;vertical-align:top;">
          <div style="font-size:26px;line-height:1;margin-bottom:7px;">↩️</div>
          <div style="font-size:11px;font-weight:700;color:#0D1B3E;margin-bottom:3px;">৭ দিনের রিটার্ন</div>
          <div style="font-size:10px;color:#6B7A99;">ঝামেলামুক্ত</div>
        </td>
      </tr>
    </table>

  </td></tr>

  <!-- ══ FOOTER ══ -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B3E;border-radius:0 0 24px 24px;">
      <tr>
        <td style="padding:30px 32px;text-align:center;">
          <div style="margin-bottom:16px;">
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 3px;">Facebook</a>
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 3px;">WhatsApp</a>
            <a href="#" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;margin:0 3px;">Instagram</a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়</p>
          <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.35);">সাহায্যের জন্য: <a href="mailto:support@beeharvest.com.bd" style="color:#FDD882;text-decoration:none;">support@beeharvest.com.bd</a></p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">© ${new Date().getFullYear()} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।</p>
        </td>
      </tr>
    </table>
  </td></tr>

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
      ? `⚡ জরুরি: নতুন অর্ডার প্রক্রিয়া করুন — ${new Date(
          order.createdAt,
        ).toLocaleString("bn-BD", {
          timeZone: "Asia/Dhaka",
        })}`
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
          ${
            order.discount > 0
              ? `
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#16a34a;">🎟️ কুপন ছাড় ${order.coupon?.code ? `<span style="background:#DCFCE7;color:#16a34a;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;">${order.coupon.code}</span>` : ""}</td>
            <td style="padding:5px 0;text-align:right;font-size:13px;color:#16a34a;font-weight:700;">-${order.discount.toLocaleString()} ৳</td>
          </tr>`
              : ""
          }
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

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Create order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 [ORDER] New order request received");

    const {
      items,
      customer,
      paymentMethod,
      deliveryCharge,
      discount,
      couponCode,
      notes,
    } = req.body;

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

    const discountAmount = Math.max(0, parseFloat(discount) || 0);
    const total = Math.max(
      0,
      subtotal + (deliveryCharge || 60) - discountAmount,
    );

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
      discount: discountAmount,
      coupon: couponCode
        ? { code: couponCode, discount: discountAmount }
        : undefined,
      deliveryCharge: deliveryCharge || 60,
      total,
      notes: notes || "",
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

    // ── FRAUD ANALYSIS (runs before response) ──────────────────────────────────
    const requestMeta = {
      ipAddress:
        (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "unknown",
      userAgent: req.headers["user-agent"] || "",
      headers: req.headers,
    };

    // Pass the full order object (just created) to the engine
    const fraudResult = await analyzeOrder(
      {
        ...order.toObject(),
        // also pass raw items from request body for price mismatch check
        items: orderItems,
        subtotal,
        total,
        deliveryCharge: deliveryCharge || 60,
        discount: discountAmount,
      },
      requestMeta,
    );

    // Save log in background (non-blocking)
    setImmediate(() => saveAnalysis(order, fraudResult, requestMeta));

    // ── FRAUD AUTO-ACTION ────────────────────────────────────────────────────────
    let fraudAutoAction = "none";

    if (fraudResult.verdict === "blocked" && fraudResult.riskScore >= 70) {
      // Hard block (score 70+) — delete order and restore stock
      await Order.findByIdAndDelete(order._id);

      const restoreOps = items.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: item.quantity } },
        },
      }));
      await Product.bulkWrite(restoreOps);

      console.warn(
        `🚫 [FRAUD] Order HARD BLOCKED & DELETED: ${order.orderNumber} | score=${fraudResult.riskScore}`,
      );

      return res.status(422).json({
        success: false,
        message:
          "আপনার অর্ডারটি প্রক্রিয়া করা যায়নি। সহায়তার জন্য যোগাযোগ করুন।",
        code: "ORDER_FRAUD_BLOCKED",
      });
    }

    // AFTER
    if (fraudResult.verdict === "blocked" && fraudResult.riskScore < 70) {
      // Medium block (score 56–69) — auto-cancel, no delete (keeps audit trail)
      fraudAutoAction = "rejected";
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: "cancelled",
        fraudAutoAction: "rejected",
        adminNotes: `🔴 FRAUD AUTO-REJECTED (score ${fraudResult.riskScore}) — ${fraudResult.allFlags.slice(0, 3).join("; ")}`,
      });
      console.warn(
        `🟠 [FRAUD] Order AUTO-REJECTED: ${order.orderNumber} | score=${fraudResult.riskScore}`,
      );
    }

    if (fraudResult.verdict === "review") {
      // Soft flag (score 26–55) — hold for manual review
      fraudAutoAction = "held";
      await Order.findByIdAndUpdate(order._id, {
        fraudAutoAction: "held",
        adminNotes: `⚠️ FRAUD REVIEW (score ${fraudResult.riskScore}) — ${fraudResult.allFlags.slice(0, 3).join("; ")}`,
      });
      console.warn(
        `⚠️  [FRAUD] Order flagged for review: ${order.orderNumber} | score=${fraudResult.riskScore}`,
      );
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // ==============================
    // ✅ RESPONSE FIRST (FAST API)
    // ==============================
    // AFTER
    res.status(201).json({
      success: true,
      data: {
        ...order.toObject(),
        fraudVerdict: fraudResult.verdict,
        fraudAutoAction,
      },
      message: "Order created successfully",
      ...(fraudResult.verdict === "review" && {
        warning: "অর্ডারটি রিভিউয়ের অপেক্ষায় রয়েছে।",
      }),
      ...(fraudAutoAction === "rejected" && {
        warning: "অর্ডারটি স্বয়ংক্রিয়ভাবে বাতিল হয়েছে।",
      }),
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

    // ── Attach fraud verdict to each order ───────────────────
    let ordersWithFraud = sanitizedOrders;
    try {
      const FraudLog = require("../models/FraudLog");
      const orderIds = sanitizedOrders.map((o) => o._id);
      const fraudLogs = await FraudLog.find({ order: { $in: orderIds } })
        .select("order verdict autoAction")
        .lean();

      const fraudMap = {};
      fraudLogs.forEach((f) => {
        fraudMap[String(f.order)] = {
          fraudVerdict: f.verdict,
          fraudAutoAction: f.autoAction,
        };
      });

      ordersWithFraud = sanitizedOrders.map((o) => ({
        ...o,
        ...(fraudMap[String(o._id)] || {}),
      }));
    } catch (fraudErr) {
      // Non-critical — return orders without fraud data rather than failing
      console.warn("⚠️ [PHONE SEARCH] Fraud lookup skipped:", fraudErr.message);
    }
    // ─────────────────────────────────────────────────────────

    res.json({
      success: true,
      count: ordersWithFraud.length,
      data: ordersWithFraud,
    });
  } catch (error) {
    console.error("❌ [PHONE SEARCH] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add these new controller functions to your orderController.js

// @desc    Get all unique customer emails
// @route   GET /api/orders/customers/emails
// @access  Private (Admin only)
const getAllCustomerEmails = async (req, res) => {
  try {
    console.log("📧 [EMAIL LIST] Fetching all customer emails");

    // Get unique customer emails from orders
    const customers = await Order.aggregate([
      {
        $group: {
          _id: "$customer.email",
          name: { $first: "$customer.name" },
          phone: { $first: "$customer.phone" },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
      {
        $match: {
          _id: { $ne: null, $exists: true, $ne: "" },
        },
      },
      {
        $sort: { lastOrderDate: -1 },
      },
    ]);

    // Filter out invalid emails
    const validCustomers = customers.filter(
      (c) => c._id && c._id.includes("@") && !c._id.includes("@loadtest.com"),
    );

    console.log(
      `✅ [EMAIL LIST] Found ${validCustomers.length} unique customer emails`,
    );

    res.json({
      success: true,
      count: validCustomers.length,
      data: validCustomers,
    });
  } catch (error) {
    console.error("❌ [EMAIL LIST] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send bulk promotional email to all customers
// @route   POST /api/orders/customers/bulk-email
// @access  Private (Admin only)
const sendBulkPromotionalEmail = async (req, res) => {
  try {
    const {
      subject,
      message,
      offerDetails,
      couponCode,
      sendToAll = true,
      testEmail,
    } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    console.log(`📧 [BULK EMAIL] Starting bulk email campaign: "${subject}"`);

    // Get all customer emails
    const customers = await Order.aggregate([
      {
        $group: {
          _id: "$customer.email",
          name: { $first: "$customer.name" },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
        },
      },
      {
        $match: {
          _id: { $ne: null, $exists: true, $ne: "" },
        },
      },
    ]);

    const validCustomers = customers.filter(
      (c) => c._id && c._id.includes("@") && !c._id.includes("@loadtest.com"),
    );

    let targetEmails = [];

    if (sendToAll) {
      targetEmails = validCustomers.map((c) => ({
        email: c._id,
        name: c.name,
      }));
    } else if (testEmail) {
      targetEmails = [{ email: testEmail, name: "Test Customer" }];
    }

    if (targetEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid customer emails found",
      });
    }

    console.log(`📧 [BULK EMAIL] Sending to ${targetEmails.length} recipients`);

    // Generate promotional email HTML
    const promotionalHtml = generatePromotionalEmailTemplate(
      subject,
      message,
      offerDetails,
      couponCode,
    );

    // Send emails in batches to avoid overwhelming the email service
    const BATCH_SIZE = 10;
    const results = {
      total: targetEmails.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < targetEmails.length; i += BATCH_SIZE) {
      const batch = targetEmails.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (customer) => {
        try {
          // Personalize the email with customer name
          let personalizedMessage = message;
          if (customer.name && customer.name !== "undefined") {
            personalizedMessage = message.replace(/{name}/g, customer.name);
          }

          const personalizedHtml = promotionalHtml.replace(
            /{name}/g,
            customer.name || "Valued Customer",
          );

          const result = await sendEmail(
            customer.email,
            subject,
            personalizedHtml,
          );

          if (result && result.success) {
            results.sent++;
            console.log(`✅ [BULK EMAIL] Sent to ${customer.email}`);
          } else {
            results.failed++;
            results.errors.push(
              `${customer.email}: ${result?.error || "Unknown error"}`,
            );
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`${customer.email}: ${err.message}`);
          console.error(
            `❌ [BULK EMAIL] Failed for ${customer.email}:`,
            err.message,
          );
        }
      });

      await Promise.allSettled(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < targetEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `✅ [BULK EMAIL] Campaign complete: ${results.sent} sent, ${results.failed} failed`,
    );

    res.json({
      success: true,
      message: `Bulk email campaign completed: ${results.sent} sent successfully, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("❌ [BULK EMAIL] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const generatePromotionalEmailTemplate = (
  subject,
  message,
  offerDetails,
  couponCode,
  recipientName = "{name}",
) => {
  const hasOffer = offerDetails && offerDetails.trim();
  const hasCoupon = couponCode && couponCode.trim();
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const year = new Date().getFullYear();

  /* ── Offer block (injected only when offerDetails is provided) ── */
  const offerBlock = hasOffer
    ? `
        <!-- Offer card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 100%);
                      border-radius:16px;margin:0 0 24px;">
          <tr>
            <td style="padding:24px 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;
                        color:rgba(255,255,255,0.65);line-height:1;">
                🎉 Special Offer
              </p>
              <p style="margin:0;font-size:26px;font-weight:800;
                        color:#FDD882;line-height:1.2;">
                ${offerDetails}
              </p>
              ${
                hasCoupon
                  ? `
              <!-- Coupon pill -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:14px auto 0;">
                <tr>
                  <td style="background:rgba(255,255,255,0.1);border-radius:12px;
                             padding:12px 24px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:1.5px;
                              color:rgba(255,255,255,0.45);">USE COUPON CODE</p>
                    <p style="margin:0;font-family:'Courier New',Courier,monospace;
                              font-size:26px;font-weight:800;letter-spacing:4px;
                              color:#FDD882;">
                      ${couponCode}
                    </p>
                  </td>
                </tr>
              </table>`
                  : ""
              }
            </td>
          </tr>
        </table>`
    : "";

  /* ── Full HTML template ── */
  return `<!DOCTYPE html>
<html lang="bn" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0;mso-table-rspace:0}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    body{margin:0;padding:0;background:#F5F0E8}
 
    /* Responsive */
    @media only screen and (max-width:600px){
      .email-wrapper{padding:12px 8px !important}
      .email-body{padding:0 18px !important}
      .hero-title{font-size:22px !important}
      .hero-pad{padding:28px 20px 14px !important}
      .trust-cell{padding:12px 4px !important}
      .trust-icon{font-size:20px !important}
      .trust-title{font-size:10px !important}
      .trust-sub{font-size:9px !important}
      .cta-btn{padding:13px 28px !important;font-size:14px !important}
      .footer-pad{padding:22px 20px !important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
 
  <!-- Outer wrapper -->
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0"
         role="presentation"
         style="background:#F5F0E8;padding:28px 16px;">
    <tr>
      <td align="center">
 
        <!-- Container -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;">
 
          <!-- ══════════════ HEADER ══════════════ -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 60%,#0D1B3E 100%);
                            border-radius:24px 24px 0 0;overflow:hidden;">
 
                <!-- Brand row -->
                <tr>
                  <td class="hero-pad" style="padding:40px 40px 20px;text-align:center;">
 
                    <!-- Logo -->
                    <table cellpadding="0" cellspacing="0" role="presentation"
                           style="margin:0 auto 28px;">
                      <tr>
                        <td style="background:linear-gradient(135deg,#F5A623,#C47F11);
                                   border-radius:14px;width:52px;height:52px;
                                   text-align:center;vertical-align:middle;
                                   font-size:26px;line-height:52px;">
                          🐝
                        </td>
                        <td style="padding-left:12px;text-align:left;vertical-align:middle;">
                          <p style="margin:0;font-size:22px;font-weight:800;
                                    color:#FFFFFF;letter-spacing:0.5px;">
                            BeeHarvest
                          </p>
                          <p style="margin:3px 0 0;font-size:11px;color:#FDD882;">
                            বাংলাদেশের বিশ্বস্ত অনলাইন শপ
                          </p>
                        </td>
                      </tr>
                    </table>
 
                    <!-- Hero heading -->
                    <h1 class="hero-title"
                        style="margin:0 0 10px;color:#FFFFFF;font-size:28px;
                               font-weight:800;line-height:1.25;">
                      ✨ ${subject}
                    </h1>
 
                    <!-- Greeting -->
                    <p style="margin:0 0 32px;color:rgba(255,255,255,0.65);
                              font-size:14px;line-height:1.6;">
                      Hello
                      <strong style="color:#FDD882;">${recipientName}</strong>,
                      we have something exciting for you!
                    </p>
 
                  </td>
                </tr>
 
                <!-- Wave divider -->
                <tr>
                  <td style="line-height:0;font-size:0;">
                    <svg width="100%" height="40" viewBox="0 0 600 40"
                         preserveAspectRatio="none"
                         xmlns="http://www.w3.org/2000/svg">
                      <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z"
                            fill="#FFF9F0"/>
                    </svg>
                  </td>
                </tr>
 
              </table>
            </td>
          </tr>
          <!-- ══════════════ END HEADER ══════════════ -->
 
          <!-- ══════════════ BODY ══════════════ -->
          <tr>
            <td class="email-body"
                style="background:#FFF9F0;padding:0 36px;">
 
              <!-- Message text -->
              <p style="margin:28px 0 24px;font-size:15px;color:#374151;line-height:1.75;">
                ${message}
              </p>
 
              ${offerBlock}
 
              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a class="cta-btn" href="${shopUrl}/shop"
                       style="display:inline-block;
                              background:linear-gradient(135deg,#F5A623,#C47F11);
                              color:#0D1B3E;text-decoration:none;
                              padding:15px 44px;border-radius:50px;
                              font-size:15px;font-weight:800;letter-spacing:0.3px;
                              mso-padding-alt:0;line-height:normal;">
                      <!--[if mso]><i style="letter-spacing:44px;mso-font-width:-100%;mso-text-raise:30pt">&nbsp;</i><![endif]-->
                      🛍️ Shop Now &amp; Save
                      <!--[if mso]><i style="letter-spacing:44px;mso-font-width:-100%">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>
 
              <!-- Trust badges -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:32px;border:1px solid #F0E8D8;
                            border-radius:14px;overflow:hidden;">
                <tr>
                  <td class="trust-cell" width="33%" align="center"
                      style="padding:16px 8px;vertical-align:top;
                             border-right:1px solid #F0E8D8;">
                    <p class="trust-icon"
                       style="margin:0 0 7px;font-size:26px;line-height:1;">🚚</p>
                    <p class="trust-title"
                       style="margin:0 0 3px;font-size:11px;font-weight:700;
                              color:#0D1B3E;">
                      Free Delivery
                    </p>
                    <p class="trust-sub"
                       style="margin:0;font-size:10px;color:#6B7A99;">
                      On orders over ৳1000
                    </p>
                  </td>
 
                  <td class="trust-cell" width="33%" align="center"
                      style="padding:16px 8px;vertical-align:top;
                             border-right:1px solid #F0E8D8;">
                    <p class="trust-icon"
                       style="margin:0 0 7px;font-size:26px;line-height:1;">🛡️</p>
                    <p class="trust-title"
                       style="margin:0 0 3px;font-size:11px;font-weight:700;
                              color:#0D1B3E;">
                      Secure Payment
                    </p>
                    <p class="trust-sub"
                       style="margin:0;font-size:10px;color:#6B7A99;">
                      100% Protected
                    </p>
                  </td>
 
                  <td class="trust-cell" width="33%" align="center"
                      style="padding:16px 8px;vertical-align:top;">
                    <p class="trust-icon"
                       style="margin:0 0 7px;font-size:26px;line-height:1;">↩️</p>
                    <p class="trust-title"
                       style="margin:0 0 3px;font-size:11px;font-weight:700;
                              color:#0D1B3E;">
                      Easy Returns
                    </p>
                    <p class="trust-sub"
                       style="margin:0;font-size:10px;color:#6B7A99;">
                      7 days hassle-free
                    </p>
                  </td>
                </tr>
              </table>
 
            </td>
          </tr>
          <!-- ══════════════ END BODY ══════════════ -->
 
          <!-- ══════════════ FOOTER ══════════════ -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:#0D1B3E;border-radius:0 0 24px 24px;">
                <tr>
                  <td class="footer-pad"
                      style="padding:30px 36px;text-align:center;">
 
                    <!-- Social links -->
                    <table cellpadding="0" cellspacing="0" role="presentation"
                           style="margin:0 auto 18px;">
                      <tr>
                        <td style="padding:0 4px;">
                          <a href="#"
                             style="display:inline-block;
                                    background:rgba(255,255,255,0.08);
                                    border:1px solid rgba(255,255,255,0.12);
                                    color:rgba(255,255,255,0.6);text-decoration:none;
                                    padding:6px 14px;border-radius:20px;font-size:12px;">
                            Facebook
                          </a>
                        </td>
                        <td style="padding:0 4px;">
                          <a href="#"
                             style="display:inline-block;
                                    background:rgba(255,255,255,0.08);
                                    border:1px solid rgba(255,255,255,0.12);
                                    color:rgba(255,255,255,0.6);text-decoration:none;
                                    padding:6px 14px;border-radius:20px;font-size:12px;">
                            WhatsApp
                          </a>
                        </td>
                        <td style="padding:0 4px;">
                          <a href="#"
                             style="display:inline-block;
                                    background:rgba(255,255,255,0.08);
                                    border:1px solid rgba(255,255,255,0.12);
                                    color:rgba(255,255,255,0.6);text-decoration:none;
                                    padding:6px 14px;border-radius:20px;font-size:12px;">
                            Instagram
                          </a>
                        </td>
                      </tr>
                    </table>
 
                    <!-- Tagline -->
                    <p style="margin:0 0 8px;font-size:13px;
                              color:rgba(255,255,255,0.45);line-height:1.6;">
                      🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়
                    </p>
 
                    <!-- Support email -->
                    <p style="margin:0 0 10px;font-size:12px;
                              color:rgba(255,255,255,0.3);">
                      সাহায্যের জন্য:
                      <a href="mailto:support@beeharvest.com.bd"
                         style="color:#FDD882;text-decoration:none;">
                        support@beeharvest.com.bd
                      </a>
                    </p>
 
                    <!-- Copyright -->
                    <p style="margin:0 0 10px;font-size:11px;
                              color:rgba(255,255,255,0.18);">
                      &copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।
                    </p>
 
                    <!-- Unsubscribe notice -->
                    <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.12);">
                      You&rsquo;re receiving this because you&rsquo;ve shopped with BeeHarvest.
                      &nbsp;|&nbsp;
                      <a href="${shopUrl}/unsubscribe"
                         style="color:rgba(255,255,255,0.2);text-decoration:underline;">
                        Unsubscribe
                      </a>
                    </p>
 
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- ══════════════ END FOOTER ══════════════ -->
 
          <!-- Bottom spacer -->
          <tr><td style="height:28px;"></td></tr>
 
        </table>
        <!-- End container -->
 
      </td>
    </tr>
  </table>
  <!-- End outer wrapper -->
 
</body>
</html>`;
};

// Add to module.exports
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
  getAllCustomerEmails,
  sendBulkPromotionalEmail,
  generateOrderEmailTemplate,
};
