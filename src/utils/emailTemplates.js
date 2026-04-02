// utils/emailTemplates.js
// BeeHarvest — Cinematic Email Templates (Customer + Admin)

// ─────────────────────────────────────────────
// SHARED STYLES (inlined for email clients)
// ─────────────────────────────────────────────
const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
`;

const HONEY = "#F5A623";
const DARK = "#0D1B3E";
const DEEP = "#060E22";
const GOLD = "#E8941A";
const CREAM = "#FFF8ED";

// ─────────────────────────────────────────────
// HELPER: format BDT
// ─────────────────────────────────────────────
const fmt = (n) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

// ─────────────────────────────────────────────
// HELPER: status badge
// ─────────────────────────────────────────────
const statusBadge = (status) => {
  const map = {
    pending: {
      label: "অপেক্ষারত",
      bg: "#FEF3C7",
      color: "#92400E",
      dot: "#F59E0B",
    },
    confirmed: {
      label: "নিশ্চিত",
      bg: "#D1FAE5",
      color: "#065F46",
      dot: "#10B981",
    },
    processing: {
      label: "প্রক্রিয়াধীন",
      bg: "#DBEAFE",
      color: "#1E40AF",
      dot: "#3B82F6",
    },
    shipped: {
      label: "পাঠানো হয়েছে",
      bg: "#EDE9FE",
      color: "#4C1D95",
      dot: "#8B5CF6",
    },
    delivered: {
      label: "ডেলিভারি সম্পন্ন",
      bg: "#D1FAE5",
      color: "#065F46",
      dot: "#10B981",
    },
    cancelled: {
      label: "বাতিল",
      bg: "#FEE2E2",
      color: "#7F1D1D",
      dot: "#EF4444",
    },
  };
  const s = map[status] || map.pending;
  return `
    <span style="
      display:inline-flex; align-items:center; gap:6px;
      background:${s.bg}; color:${s.color};
      padding:5px 14px; border-radius:999px;
      font-size:13px; font-weight:600; letter-spacing:0.02em;
    ">
      <span style="width:7px;height:7px;border-radius:50%;background:${s.dot};display:inline-block;"></span>
      ${s.label}
    </span>`;
};

// ─────────────────────────────────────────────
// HELPER: payment method label
// ─────────────────────────────────────────────
const payLabel = (method) => {
  const map = {
    COD: { label: "ক্যাশ অন ডেলিভারি", icon: "💵" },
    bkash: { label: "bKash", icon: "📱" },
    nagad: { label: "Nagad", icon: "💳" },
  };
  const p = map[method] || { label: method, icon: "💰" };
  return `${p.icon} ${p.label}`;
};

// ─────────────────────────────────────────────
// SHARED: HEADER BLOCK
// ─────────────────────────────────────────────
const header = (subtitle = "") => `
  <tr>
    <td style="background:${DEEP}; padding:0;">
      <!-- honeycomb pattern strip -->
      <div style="background:linear-gradient(135deg,${DEEP} 0%,#0A1628 50%,${DEEP} 100%); position:relative; overflow:hidden;">
        <!-- Decorative glow -->
        <div style="
          position:absolute; top:-60px; left:50%; transform:translateX(-50%);
          width:400px; height:200px;
          background:radial-gradient(ellipse,rgba(245,166,35,0.18) 0%,transparent 70%);
          pointer-events:none;
        "></div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:48px 48px 36px; text-align:center; position:relative;">
              <!-- Logo Row -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,${HONEY},${GOLD});
                    border-radius:16px; padding:12px 16px;
                    vertical-align:middle; line-height:1;
                  ">
                    <span style="font-size:28px; filter:brightness(0) invert(1);">🐝</span>
                  </td>
                  <td style="width:14px;"></td>
                  <td style="vertical-align:middle; text-align:left;">
                    <div style="
                      font-family:'DM Serif Display',Georgia,serif;
                      font-size:26px; font-weight:400;
                      color:#FFFFFF; letter-spacing:0.01em; line-height:1.1;
                    ">BeeHarvest</div>
                    <div style="
                      font-family:'DM Sans',Arial,sans-serif;
                      font-size:11px; color:rgba(255,255,255,0.45);
                      letter-spacing:0.1em; text-transform:uppercase; margin-top:2px;
                    ">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</div>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <div style="
                width:60px; height:2px; margin:20px auto 18px;
                background:linear-gradient(90deg,transparent,${HONEY},transparent);
              "></div>
              ${
                subtitle
                  ? `
              <p style="
                font-family:'DM Sans',Arial,sans-serif;
                font-size:13px; color:rgba(255,255,255,0.45);
                margin:0; letter-spacing:0.06em; text-transform:uppercase;
              ">${subtitle}</p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </div>
      <!-- Amber accent bar -->
      <div style="height:3px; background:linear-gradient(90deg,transparent 0%,${HONEY} 30%,${GOLD} 70%,transparent 100%);"></div>
    </td>
  </tr>`;

// ─────────────────────────────────────────────
// SHARED: FOOTER BLOCK
// ─────────────────────────────────────────────
const footer = () => `
  <tr>
    <td style="background:${DEEP}; padding:0;">
      <div style="height:1px; background:linear-gradient(90deg,transparent,rgba(245,166,35,0.3),transparent); margin:0 40px;"></div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 48px 24px; text-align:center;">
            <!-- Trust icons row -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
              <tr>
                <td style="padding:0 16px; text-align:center;">
                  <div style="font-size:20px; margin-bottom:4px;">🛡️</div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:0.06em; text-transform:uppercase;">নিরাপদ</div>
                </td>
                <td style="width:1px; background:rgba(255,255,255,0.08);"></td>
                <td style="padding:0 16px; text-align:center;">
                  <div style="font-size:20px; margin-bottom:4px;">🚀</div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:0.06em; text-transform:uppercase;">দ্রুত</div>
                </td>
                <td style="width:1px; background:rgba(255,255,255,0.08);"></td>
                <td style="padding:0 16px; text-align:center;">
                  <div style="font-size:20px; margin-bottom:4px;">🔄</div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:0.06em; text-transform:uppercase;">৭ দিন রিটার্ন</div>
                </td>
                <td style="width:1px; background:rgba(255,255,255,0.08);"></td>
                <td style="padding:0 16px; text-align:center;">
                  <div style="font-size:20px; margin-bottom:4px;">🎧</div>
                  <div style="font-family:'DM Sans',Arial,sans-serif; font-size:10px; color:rgba(255,255,255,0.35); letter-spacing:0.06em; text-transform:uppercase;">২৪/৭ সাপোর্ট</div>
                </td>
              </tr>
            </table>
            <!-- Social row -->
            <div style="margin-bottom:20px;">
              <a href="tel:01700000000" style="
                display:inline-block; margin:0 6px;
                background:rgba(245,166,35,0.12); border:1px solid rgba(245,166,35,0.25);
                color:${HONEY}; font-family:'DM Sans',Arial,sans-serif;
                font-size:12px; font-weight:500; text-decoration:none;
                padding:6px 14px; border-radius:999px; letter-spacing:0.03em;
              ">📞 01700-000000</a>
              <a href="mailto:support@beeharvest.com.bd" style="
                display:inline-block; margin:0 6px;
                background:rgba(245,166,35,0.12); border:1px solid rgba(245,166,35,0.25);
                color:${HONEY}; font-family:'DM Sans',Arial,sans-serif;
                font-size:12px; font-weight:500; text-decoration:none;
                padding:6px 14px; border-radius:999px; letter-spacing:0.03em;
              ">✉️ support@beeharvest.com.bd</a>
            </div>
            <!-- Copyright -->
            <p style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:11px; color:rgba(255,255,255,0.22);
              margin:0; letter-spacing:0.04em;
            ">
              © ২০২৫ BeeHarvest · বাংলাদেশে তৈরি 🇧🇩 · সর্বস্বত্ব সংরক্ষিত
            </p>
            <p style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:10px; color:rgba(255,255,255,0.15);
              margin:8px 0 0; letter-spacing:0.03em;
            ">
              আপনি এই ইমেইলটি পাচ্ছেন কারণ আপনি beeharvest.com.bd-তে অর্ডার করেছেন।
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

// ─────────────────────────────────────────────
// HELPER: items table rows
// ─────────────────────────────────────────────
const itemRows = (items = []) =>
  items
    .map(
      (item, i) => `
    <tr style="${i > 0 ? `border-top:1px solid rgba(245,166,35,0.08);` : ""}">
      <td style="padding:14px 0; vertical-align:middle;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="
            width:48px; height:48px; border-radius:12px;
            background:linear-gradient(135deg,rgba(245,166,35,0.15),rgba(245,166,35,0.05));
            border:1px solid rgba(245,166,35,0.2);
            display:flex; align-items:center; justify-content:center;
            font-size:22px; flex-shrink:0;
          ">${item.emoji || "📦"}</div>
          <div>
            <div style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:14px; font-weight:600;
              color:#FFFFFF; margin-bottom:3px;
            ">${item.name || item.productName || "পণ্য"}</div>
            <div style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:12px; color:rgba(255,255,255,0.4);
            ">পরিমাণ: ${item.quantity || 1}</div>
          </div>
        </div>
      </td>
      <td style="padding:14px 0; text-align:right; vertical-align:middle;">
        <div style="
          font-family:'DM Serif Display',Georgia,serif;
          font-size:16px; color:${HONEY}; font-weight:400;
        ">${fmt((item.price || 0) * (item.quantity || 1))}</div>
      </td>
    </tr>`,
    )
    .join("");

// ─────────────────────────────────────────────
// HELPER: wrap in full email shell
// ─────────────────────────────────────────────
const wrap = (bodyRows) => `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>BeeHarvest</title>
  <style>
    ${BASE_STYLES}
    body { margin:0; padding:0; background:#060E22; }
    a { color:${HONEY}; }
    * { box-sizing:border-box; }
    @media (max-width:600px) {
      .email-wrap { width:100% !important; }
      .email-pad  { padding:28px 24px !important; }
      .hide-mobile { display:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#060E22;font-family:'DM Sans',Arial,sans-serif;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    BeeHarvest — বাংলাদেশের বিশ্বস্ত অনলাইন শপ ✦ আপনার অর্ডার আমরা পেয়েছি
  </div>
  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060E22;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table class="email-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="
          background:${DARK}; border-radius:20px; overflow:hidden;
          border:1px solid rgba(245,166,35,0.12);
          box-shadow:0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,166,35,0.06) inset;
        ">
          ${bodyRows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ═══════════════════════════════════════════════════════════════════
// 1. ORDER CONFIRMATION (Customer)
// ═══════════════════════════════════════════════════════════════════
const orderConfirmationCustomer = (order) => {
  const {
    orderNumber,
    customerName,
    customerEmail,
    shippingAddress = {},
    items = [],
    subtotal,
    shippingCost,
    totalAmount,
    paymentMethod,
    status = "confirmed",
    createdAt,
  } = order;

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  return wrap(`
    ${header("অর্ডার নিশ্চিতকরণ")}

    <!-- HERO BAND -->
    <tr>
      <td style="padding:0;">
        <div style="
          background:linear-gradient(135deg,rgba(245,166,35,0.08) 0%,rgba(245,166,35,0.02) 100%);
          border-bottom:1px solid rgba(245,166,35,0.1);
          padding:48px 48px 40px; text-align:center;
        ">
          <!-- Big checkmark -->
          <div style="
            width:72px; height:72px; border-radius:50%;
            background:linear-gradient(135deg,${HONEY},${GOLD});
            margin:0 auto 20px;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 0 12px rgba(245,166,35,0.1), 0 12px 32px rgba(245,166,35,0.35);
            font-size:32px; line-height:72px; text-align:center;
          ">✓</div>
          <h1 style="
            font-family:'DM Serif Display',Georgia,serif;
            font-size:32px; font-weight:400; color:#FFFFFF;
            margin:0 0 10px; letter-spacing:-0.01em; line-height:1.2;
          ">অর্ডার নিশ্চিত হয়েছে!</h1>
          <p style="
            font-family:'DM Sans',Arial,sans-serif;
            font-size:15px; color:rgba(255,255,255,0.55);
            margin:0; line-height:1.6;
          ">ধন্যবাদ ${customerName || "প্রিয় গ্রাহক"}! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।</p>

          <!-- Order number chip -->
          <div style="
            display:inline-block; margin-top:24px;
            background:rgba(245,166,35,0.12); border:1px solid rgba(245,166,35,0.35);
            border-radius:999px; padding:10px 24px;
          ">
            <span style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:11px; color:rgba(255,255,255,0.4);
              text-transform:uppercase; letter-spacing:0.1em; margin-right:10px;
            ">অর্ডার নম্বর</span>
            <span style="
              font-family:'DM Serif Display',Georgia,serif;
              font-size:18px; color:${HONEY}; letter-spacing:0.02em;
            ">${orderNumber}</span>
          </div>

          <!-- Status + Date row -->
          <div style="margin-top:18px;">
            ${statusBadge(status)}
            <span style="
              font-family:'DM Sans',Arial,sans-serif;
              font-size:13px; color:rgba(255,255,255,0.3);
              margin-left:12px;
            ">${dateStr}</span>
          </div>
        </div>
      </td>
    </tr>

    <!-- ORDER ITEMS -->
    <tr>
      <td class="email-pad" style="padding:36px 48px 0;">
        <div style="
          font-family:'DM Sans',Arial,sans-serif;
          font-size:11px; color:rgba(255,255,255,0.3);
          text-transform:uppercase; letter-spacing:0.1em; margin-bottom:18px;
          display:flex; align-items:center; gap:8px;
        ">
          <span style="display:inline-block;width:16px;height:1px;background:rgba(245,166,35,0.4);"></span>
          অর্ডার বিবরণ
          <span style="display:inline-block;flex:1;height:1px;background:rgba(255,255,255,0.06);"></span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${itemRows(items)}
        </table>
      </td>
    </tr>

    <!-- TOTALS BLOCK -->
    <tr>
      <td class="email-pad" style="padding:24px 48px;">
        <div style="
          background:rgba(0,0,0,0.25); border:1px solid rgba(245,166,35,0.1);
          border-radius:16px; padding:24px;
        ">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);padding:5px 0;">পণ্যের মূল্য</td>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.7);text-align:right;padding:5px 0;">${fmt(subtotal)}</td>
            </tr>
            <tr>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);padding:5px 0;">ডেলিভারি চার্জ</td>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.7);text-align:right;padding:5px 0;">${fmt(shippingCost)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:12px 0 4px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(245,166,35,0.3),transparent);"></div></td>
            </tr>
            <tr>
              <td style="font-family:'DM Serif Display',Georgia,serif;font-size:18px;color:#FFFFFF;padding:4px 0;">মোট প্রদেয়</td>
              <td style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:${HONEY};text-align:right;padding:4px 0;">${fmt(totalAmount)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:12px;">
                <div style="
                  background:rgba(245,166,35,0.06); border-radius:8px;
                  padding:8px 14px; display:inline-block;
                  font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.5);
                ">${payLabel(paymentMethod)}</div>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- DELIVERY INFO -->
    <tr>
      <td class="email-pad" style="padding:0 48px 36px;">
        <div style="
          background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06);
          border-radius:16px; padding:24px;
        ">
          <div style="
            font-family:'DM Sans',Arial,sans-serif;font-size:11px;
            color:rgba(255,255,255,0.3);text-transform:uppercase;
            letter-spacing:0.1em; margin-bottom:16px;
          ">📍 ডেলিভারি ঠিকানা</div>
          <div style="
            font-family:'DM Sans',Arial,sans-serif;font-size:14px;
            color:rgba(255,255,255,0.75); line-height:1.7;
          ">
            <strong style="color:#FFFFFF;font-weight:600;">${customerName}</strong><br/>
            ${shippingAddress.address || ""}<br/>
            ${shippingAddress.city || ""} ${shippingAddress.zipCode ? "- " + shippingAddress.zipCode : ""}<br/>
            📞 ${order.customerPhone || ""}
          </div>
        </div>
      </td>
    </tr>

    <!-- TIMELINE STEPS -->
    <tr>
      <td class="email-pad" style="padding:0 48px 36px;">
        <div style="
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;
          color:rgba(255,255,255,0.3);text-transform:uppercase;
          letter-spacing:0.1em; margin-bottom:20px;
          display:flex;align-items:center;gap:8px;
        ">
          <span style="display:inline-block;width:16px;height:1px;background:rgba(245,166,35,0.4);"></span>
          আপনার অর্ডারের পরবর্তী ধাপ
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${[
            {
              step: "১",
              label: "অর্ডার নিশ্চিত",
              desc: "আমরা আপনার অর্ডার পেয়েছি",
              done: true,
            },
            {
              step: "২",
              label: "প্রক্রিয়াকরণ",
              desc: "পণ্য প্যাকেজিং চলছে",
              done: false,
            },
            {
              step: "৩",
              label: "শিপমেন্ট",
              desc: "কুরিয়ারে পাঠানো হবে",
              done: false,
            },
            {
              step: "৪",
              label: "ডেলিভারি",
              desc: "আপনার দরজায় পৌঁছাবে",
              done: false,
            },
          ]
            .map(
              (s) => `
            <tr>
              <td width="44" style="vertical-align:top;padding-bottom:20px;">
                <div style="
                  width:36px; height:36px; border-radius:50%;
                  background:${s.done ? `linear-gradient(135deg,${HONEY},${GOLD})` : "rgba(255,255,255,0.06)"};
                  border:${s.done ? "none" : "1px solid rgba(255,255,255,0.1)"};
                  display:flex;align-items:center;justify-content:center;
                  font-family:'DM Sans',Arial,sans-serif;
                  font-size:13px;font-weight:700;
                  color:${s.done ? "#000" : "rgba(255,255,255,0.3)"};
                  text-align:center;line-height:36px;
                  box-shadow:${s.done ? `0 4px 16px rgba(245,166,35,0.4)` : "none"};
                ">${s.step}</div>
              </td>
              <td style="padding:0 0 20px 14px;vertical-align:top;">
                <div style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;color:${s.done ? "#FFFFFF" : "rgba(255,255,255,0.4)"};margin-bottom:2px;">${s.label}</div>
                <div style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.3);">${s.desc}</div>
              </td>
            </tr>`,
            )
            .join("")}
        </table>
      </td>
    </tr>

    <!-- CTA BUTTON -->
    <tr>
      <td style="padding:0 48px 48px; text-align:center;">
        <a href="https://beeharvest.com.bd" style="
          display:inline-block;
          background:linear-gradient(135deg,${HONEY} 0%,${GOLD} 100%);
          color:#000000; font-family:'DM Sans',Arial,sans-serif;
          font-size:15px; font-weight:700; text-decoration:none;
          padding:16px 40px; border-radius:12px;
          letter-spacing:0.04em;
          box-shadow:0 8px 24px rgba(245,166,35,0.4);
        ">🛍️ আরও কেনাকাটা করুন</a>
        <p style="
          font-family:'DM Sans',Arial,sans-serif;font-size:12px;
          color:rgba(255,255,255,0.25); margin:14px 0 0;
        ">অর্ডার ট্র্যাক করুন: beeharvest.com.bd</p>
      </td>
    </tr>

    ${footer()}
  `);
};

// ═══════════════════════════════════════════════════════════════════
// 2. ORDER STATUS UPDATE (Customer)
// ═══════════════════════════════════════════════════════════════════
const orderStatusUpdateCustomer = (order) => {
  const { orderNumber, customerName, status, trackingNumber } = order;

  const statusMessages = {
    processing: {
      headline: "আপনার অর্ডার প্রস্তুত হচ্ছে!",
      body: "আমাদের টিম আপনার পণ্য যত্নসহকারে প্যাক করছে।",
      emoji: "📦",
    },
    shipped: {
      headline: "অর্ডার পাঠানো হয়েছে!",
      body: "আপনার পণ্য রাস্তায় আছে। শীঘ্রই আপনার কাছে পৌঁছাবে।",
      emoji: "🚚",
    },
    delivered: {
      headline: "ডেলিভারি সম্পন্ন!",
      body: "আপনার পণ্য পৌঁছে গেছে। কেনাকাটায় ধন্যবাদ!",
      emoji: "🎉",
    },
    cancelled: {
      headline: "অর্ডার বাতিল করা হয়েছে",
      body: "আপনার অর্ডারটি বাতিল হয়েছে। কোনো প্রশ্ন থাকলে যোগাযোগ করুন।",
      emoji: "❌",
    },
  };

  const msg = statusMessages[status] || {
    headline: "অর্ডার আপডেট",
    body: "আপনার অর্ডারে পরিবর্তন হয়েছে।",
    emoji: "ℹ️",
  };

  return wrap(`
    ${header("অর্ডার স্ট্যাটাস আপডেট")}

    <tr>
      <td style="padding:48px 48px 36px; text-align:center;">
        <div style="font-size:56px; margin-bottom:16px;">${msg.emoji}</div>
        <h1 style="
          font-family:'DM Serif Display',Georgia,serif;
          font-size:28px; font-weight:400; color:#FFFFFF;
          margin:0 0 10px;
        ">${msg.headline}</h1>
        <p style="
          font-family:'DM Sans',Arial,sans-serif;
          font-size:15px; color:rgba(255,255,255,0.5);
          margin:0 0 24px; line-height:1.6;
        ">${msg.body}</p>

        <div style="display:inline-block; margin-bottom:20px;">
          ${statusBadge(status)}
        </div>

        <div style="
          background:rgba(0,0,0,0.3); border:1px solid rgba(245,166,35,0.15);
          border-radius:14px; padding:20px 32px; display:inline-block; margin-top:8px;
        ">
          <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">অর্ডার নম্বর</div>
          <div style="font-family:'DM Serif Display',Georgia,serif;font-size:20px;color:${HONEY};">${orderNumber}</div>
          ${
            trackingNumber
              ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">ট্র্যাকিং নম্বর</div>
            <div style="font-family:'DM Serif Display',Georgia,serif;font-size:18px;color:#FFFFFF;">${trackingNumber}</div>
          </div>`
              : ""
          }
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:0 48px 48px; text-align:center;">
        <a href="https://beeharvest.com.bd" style="
          display:inline-block;
          background:linear-gradient(135deg,${HONEY},${GOLD});
          color:#000; font-family:'DM Sans',Arial,sans-serif;
          font-size:15px; font-weight:700; text-decoration:none;
          padding:16px 40px; border-radius:12px; letter-spacing:0.04em;
          box-shadow:0 8px 24px rgba(245,166,35,0.4);
        ">📡 অর্ডার ট্র্যাক করুন</a>
      </td>
    </tr>

    ${footer()}
  `);
};

// ═══════════════════════════════════════════════════════════════════
// 3. NEW ORDER ALERT (Admin)
// ═══════════════════════════════════════════════════════════════════
const newOrderAdmin = (order) => {
  const {
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    items = [],
    subtotal,
    shippingCost,
    totalAmount,
    paymentMethod,
    status,
    shippingAddress = {},
    createdAt,
    notes,
  } = order;

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString("bn-BD")
    : new Date().toLocaleString("bn-BD");

  return wrap(`
    <!-- ADMIN HEADER (different color) -->
    <tr>
      <td style="background:${DEEP}; padding:0;">
        <div style="
          background:linear-gradient(135deg,rgba(59,130,246,0.12) 0%,rgba(245,166,35,0.06) 100%);
          position:relative; overflow:hidden;
        ">
          <div style="
            position:absolute;top:-40px;right:-40px;width:200px;height:200px;
            background:radial-gradient(ellipse,rgba(59,130,246,0.15),transparent 70%);
          "></div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:36px 48px 28px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="
                      background:linear-gradient(135deg,${HONEY},${GOLD});
                      border-radius:14px; padding:10px 14px;
                      vertical-align:middle; line-height:1;
                    ">
                      <span style="font-size:24px; filter:brightness(0) invert(1);">🐝</span>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="vertical-align:middle;">
                      <div style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#FFF;">BeeHarvest</div>
                      <div style="font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Admin Dashboard</div>
                    </td>
                    <td style="text-align:right;vertical-align:middle;padding-left:20px;">
                      <div style="
                        background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3);
                        border-radius:999px; padding:6px 16px; display:inline-block;
                        font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;
                        color:#FCA5A5; letter-spacing:0.08em; text-transform:uppercase;
                      ">🔴 নতুন অর্ডার</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
        <div style="height:2px;background:linear-gradient(90deg,rgba(59,130,246,0.6),${HONEY},rgba(59,130,246,0.6));"></div>
      </td>
    </tr>

    <!-- ALERT HERO -->
    <tr>
      <td style="
        padding:40px 48px 28px;
        background:linear-gradient(180deg,rgba(245,166,35,0.05) 0%,transparent 100%);
      ">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <h1 style="
                font-family:'DM Serif Display',Georgia,serif;
                font-size:26px; font-weight:400; color:#FFFFFF;
                margin:0 0 6px;
              ">💰 নতুন অর্ডার এসেছে!</h1>
              <p style="
                font-family:'DM Sans',Arial,sans-serif;
                font-size:14px; color:rgba(255,255,255,0.45);
                margin:0;
              ">${dateStr}</p>
            </td>
            <td style="text-align:right; vertical-align:top;">
              <div style="
                background:rgba(0,0,0,0.3); border:1px solid rgba(245,166,35,0.2);
                border-radius:14px; padding:16px 24px; display:inline-block; text-align:center;
              ">
                <div style="font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">মোট মূল্য</div>
                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:28px;color:${HONEY};">${fmt(totalAmount)}</div>
                <div style="margin-top:8px;">${statusBadge(status || "pending")}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ORDER META -->
    <tr>
      <td style="padding:0 48px 28px;">
        <div style="
          background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06);
          border-radius:16px; padding:24px; margin-bottom:20px;
        ">
          <div style="
            font-family:'DM Sans',Arial,sans-serif;font-size:11px;
            color:rgba(255,255,255,0.3);text-transform:uppercase;
            letter-spacing:0.1em; margin-bottom:18px;
          ">📋 অর্ডার তথ্য</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${[
              ["অর্ডার নম্বর", orderNumber, HONEY],
              ["পেমেন্ট পদ্ধতি", payLabel(paymentMethod), null],
              ["পণ্যের সংখ্যা", `${items.length}টি আইটেম`, null],
              ["ডেলিভারি চার্জ", fmt(shippingCost), null],
            ]
              .map(
                ([label, value, color]) => `
              <tr>
                <td style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);padding:6px 0;width:50%;">${label}</td>
                <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;color:${color || "rgba(255,255,255,0.85)"};text-align:right;padding:6px 0;">${value}</td>
              </tr>`,
              )
              .join("")}
          </table>
        </div>

        <!-- CUSTOMER INFO -->
        <div style="
          background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.15);
          border-radius:16px; padding:24px; margin-bottom:20px;
        ">
          <div style="
            font-family:'DM Sans',Arial,sans-serif;font-size:11px;
            color:rgba(99,179,237,0.7);text-transform:uppercase;
            letter-spacing:0.1em; margin-bottom:18px;
          ">👤 গ্রাহকের তথ্য</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${[
              ["নাম", customerName],
              ["ইমেইল", customerEmail],
              ["ফোন", customerPhone],
              [
                "ঠিকানা",
                [
                  shippingAddress.address,
                  shippingAddress.city,
                  shippingAddress.zipCode,
                ]
                  .filter(Boolean)
                  .join(", "),
              ],
            ]
              .map(
                ([label, value]) => `
              <tr>
                <td style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);padding:6px 0;width:30%;vertical-align:top;">${label}</td>
                <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.85);padding:6px 0;vertical-align:top;">${value || "—"}</td>
              </tr>`,
              )
              .join("")}
            ${
              notes
                ? `
              <tr>
                <td colspan="2" style="padding-top:12px;">
                  <div style="
                    background:rgba(245,166,35,0.08); border-left:3px solid ${HONEY};
                    border-radius:0 8px 8px 0; padding:10px 14px;
                    font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.6);
                  ">💬 নোট: ${notes}</div>
                </td>
              </tr>`
                : ""
            }
          </table>
        </div>
      </td>
    </tr>

    <!-- ITEMS TABLE -->
    <tr>
      <td style="padding:0 48px 28px;">
        <div style="
          background:rgba(0,0,0,0.25); border:1px solid rgba(245,166,35,0.1);
          border-radius:16px; padding:24px;
        ">
          <div style="
            font-family:'DM Sans',Arial,sans-serif;font-size:11px;
            color:rgba(255,255,255,0.3);text-transform:uppercase;
            letter-spacing:0.1em; margin-bottom:18px;
          ">📦 অর্ডার করা পণ্যসমূহ</div>
          <!-- Column headers -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.08em;text-transform:uppercase;padding-bottom:10px;">পণ্য</td>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.08em;text-transform:uppercase;padding-bottom:10px;text-align:center;width:60px;">পরিমাণ</td>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.08em;text-transform:uppercase;padding-bottom:10px;text-align:right;width:80px;">একক</td>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.08em;text-transform:uppercase;padding-bottom:10px;text-align:right;width:90px;">মোট</td>
            </tr>
            ${items
              .map(
                (item, i) => `
              <tr style="${i > 0 ? "border-top:1px solid rgba(255,255,255,0.04);" : ""}">
                <td style="padding:12px 0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.8);">
                  ${item.emoji || "📦"} ${item.name || item.productName}
                </td>
                <td style="padding:12px 0;text-align:center;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.5);">${item.quantity}</td>
                <td style="padding:12px 0;text-align:right;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.5);">${fmt(item.price)}</td>
                <td style="padding:12px 0;text-align:right;font-family:'DM Serif Display',Georgia,serif;font-size:15px;color:${HONEY};">${fmt(item.price * item.quantity)}</td>
              </tr>`,
              )
              .join("")}
            <!-- Totals -->
            <tr style="border-top:1px solid rgba(245,166,35,0.2);">
              <td colspan="3" style="padding:14px 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);">পণ্যের মূল্য</td>
              <td style="padding:14px 0 4px;text-align:right;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.7);">${fmt(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:4px 0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);">ডেলিভারি</td>
              <td style="padding:4px 0;text-align:right;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.7);">${fmt(shippingCost)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:12px 0 0;font-family:'DM Serif Display',Georgia,serif;font-size:18px;color:#FFF;">মোট</td>
              <td style="padding:12px 0 0;text-align:right;font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:${HONEY};">${fmt(totalAmount)}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- ADMIN CTA -->
    <tr>
      <td style="padding:0 48px 48px; text-align:center;">
        <a href="https://beeharvest.com.bd/admin/orders" style="
          display:inline-block;
          background:linear-gradient(135deg,${HONEY},${GOLD});
          color:#000; font-family:'DM Sans',Arial,sans-serif;
          font-size:15px; font-weight:700; text-decoration:none;
          padding:16px 40px; border-radius:12px; letter-spacing:0.04em;
          box-shadow:0 8px 24px rgba(245,166,35,0.4);
        ">⚡ অ্যাডমিন প্যানেলে দেখুন</a>
        <p style="
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;
          color:rgba(255,255,255,0.2); margin:12px 0 0;
        ">এই ইমেইল স্বয়ংক্রিয়ভাবে জেনারেট হয়েছে — BeeHarvest System</p>
      </td>
    </tr>

    ${footer()}
  `);
};

// ═══════════════════════════════════════════════════════════════════
// 4. LOW STOCK ALERT (Admin)
// ═══════════════════════════════════════════════════════════════════
const lowStockAdmin = (products = []) =>
  wrap(`
  ${header("স্টক সতর্কতা")}

  <tr>
    <td style="padding:40px 48px 28px; text-align:center;">
      <div style="font-size:48px; margin-bottom:12px;">⚠️</div>
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:#FFFFFF;margin:0 0 8px;">স্টক সতর্কতা!</h1>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.45);margin:0;">নিচের পণ্যগুলোর স্টক কম হয়ে গেছে। দ্রুত রিস্টক করুন।</p>
    </td>
  </tr>

  <tr>
    <td style="padding:0 48px 48px;">
      <div style="
        background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2);
        border-radius:16px; padding:24px;
      ">
        ${products
          .map(
            (p, i) => `
          <div style="
            ${i > 0 ? "border-top:1px solid rgba(239,68,68,0.1); margin-top:16px; padding-top:16px;" : ""}
            display:flex; align-items:center; justify-content:space-between;
          ">
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.8);">
              📦 ${p.name}
            </div>
            <div style="
              background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4);
              border-radius:999px; padding:4px 14px;
              font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;
              color:#FCA5A5;
            ">স্টক: ${p.stock}</div>
          </div>`,
          )
          .join("")}
      </div>
    </td>
  </tr>

  ${footer()}
`);

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
module.exports = {
  orderConfirmationCustomer,
  orderStatusUpdateCustomer,
  newOrderAdmin,
  lowStockAdmin,
};
