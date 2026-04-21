/**
 * Generates the post-delivery review request email.
 * Called from orderController after status → delivered.
 * Each item in the order gets its own review button/link.
 */
function generateReviewRequestEmail(order, reviewLinks) {
  // reviewLinks = [{ productName, productId, reviewUrl }]
  const year = new Date().getFullYear();
  const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const productCards = reviewLinks
    .map(
      ({ productName, reviewUrl, productImage }) => `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border:1px solid #E8EBF4;
                  border-radius:16px;margin-bottom:14px;
                  box-shadow:0 2px 8px rgba(13,27,62,0.04);">
      <tr>
        <td style="padding:16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;width:60px;padding-right:14px;">
                <div style="width:52px;height:52px;background:#F0E8D8;
                            border-radius:10px;display:flex;align-items:center;
                            justify-content:center;overflow:hidden;">
                  ${
                    productImage
                      ? `<img src="${productImage}" alt="${productName}" 
                              style="width:100%;height:100%;object-fit:cover;">`
                      : `<span style="font-size:24px;">🍯</span>`
                  }
                </div>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:15px;font-weight:700;color:#0D1B3E;line-height:1.3;">
                  ${productName}
                </p>
                <p style="margin:6px 0 0;font-size:12px;color:#6B7A99;line-height:1.4;">
                  ⭐ আপনার অভিজ্ঞতা শেয়ার করুন
                </p>
              </td>
              <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:16px;">
                <a href="${reviewUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);
                          color:#0D1B3E;text-decoration:none;padding:10px 20px;
                          border-radius:50px;font-size:13px;font-weight:700;
                          white-space:nowrap;">
                  ⭐ রিভিউ দিন
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,
    )
    .join("");

  // If no products, show a fallback
  const noProductsFallback = !reviewLinks.length
    ? `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFFFFF;border:1px solid #E8EBF4;
                  border-radius:16px;margin-bottom:14px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#6B7A99;">
          আপনার অর্ডারের পণ্যগুলো রিভিউ করার জন্য প্রস্তুত।
        </p>
        <a href="${shopUrl}/orders"
           style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);
                  color:#0D1B3E;text-decoration:none;padding:12px 24px;
                  border-radius:50px;font-size:13px;font-weight:700;margin-top:12px;">
          📦 আমার অর্ডারগুলো দেখুন
        </a>
      </td></tr>
    </table>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=yes"/>
  <title>আপনার রিভিউ দিন — BeeHarvest</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .inner-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .product-card { padding: 12px !important; }
      .product-image-col { width: 48px !important; padding-right: 10px !important; }
      .product-image { width: 42px !important; height: 42px !important; }
      .product-name { font-size: 13px !important; }
      .review-btn { padding: 8px 16px !important; font-size: 12px !important; white-space: nowrap !important; }
      .btn-cell { padding-left: 10px !important; }
      .header-title { font-size: 20px !important; }
      .header-subtitle { font-size: 12px !important; }
      .hero-icon { width: 44px !important; height: 44px !important; font-size: 22px !important; line-height: 44px !important; }
      .footer-text { font-size: 11px !important; }
    }
    @media only screen and (max-width: 480px) {
      .product-row { display: block !important; text-align: center !important; }
      .product-image-col { width: 100% !important; text-align: center !important; padding-right: 0 !important; padding-bottom: 10px !important; }
      .product-info-col { display: block !important; text-align: center !important; padding-bottom: 10px !important; }
      .btn-cell { display: block !important; text-align: center !important; padding-left: 0 !important; }
      .review-btn { width: 100% !important; text-align: center !important; }
      .header-logo-table { margin: 0 auto 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;
             font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:20px 12px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" class="container" style="max-width:580px;width:100%;">

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- HEADER SECTION -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 100%);
                    border-radius:24px 24px 0 0;">
        <tr>
          <td style="padding:32px 28px 24px;text-align:center;">
            <!-- Logo and Brand -->
            <table cellpadding="0" cellspacing="0" class="header-logo-table" style="margin:0 auto 20px;">
              <tr>
                <td style="background:linear-gradient(135deg,#F5A623,#C47F11);
                           border-radius:14px;width:48px;height:48px;
                           text-align:center;vertical-align:middle;
                           font-size:24px;">🐝</td>
                <td style="padding-left:10px;text-align:left;vertical-align:middle;">
                  <p style="margin:0;font-size:20px;font-weight:800;color:#fff;">BeeHarvest</p>
                  <p style="margin:3px 0 0;font-size:10px;color:#FDD882;letter-spacing:0.3px;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</p>
                </td>
              </tr>
            </table>
            
            <!-- Hero Icon -->
            <div style="font-size:52px;margin-bottom:12px;">⭐</div>
            
            <!-- Title -->
            <h1 class="header-title" style="margin:0 0 12px;color:#fff;font-size:22px;font-weight:800;line-height:1.3;">
              আপনার মতামত আমাদের কাছে<br>গুরুত্বপূর্ণ!
            </h1>
            
            <!-- Message -->
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
              প্রিয় <strong style="color:#FDD882;">${escapeHtml(order.customer.name)}</strong>,
              আপনার অর্ডার <strong style="color:#FDD882;">${order.orderNumber}</strong>
              ডেলিভারি সম্পন্ন হয়েছে। আপনার রিভিউ অন্য ক্রেতাদের সিদ্ধান্ত নিতে সাহায্য করে।
            </p>
          </td>
        </tr>
        <tr>
          <td style="line-height:0;font-size:0;">
            <svg width="100%" height="32" viewBox="0 0 600 32"
                 preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,32 C150,0 450,32 600,32 L600,32 L0,32 Z" fill="#FFF9F0"/>
            </svg>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- BODY SECTION -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <tr><td style="background:#FFF9F0;padding:0 24px;">
      
      <!-- Instruction -->
      <p style="margin:24px 0 20px;font-size:13px;color:#374151;line-height:1.6;text-align:center;">
        🎁 নিচের প্রতিটি পণ্যের জন্য আলাদাভাবে রিভিউ দিতে পারবেন।
        প্রতিটি লিংক <strong style="color:#C47F11;">৭ দিন</strong> পর্যন্ত কার্যকর থাকবে।
      </p>

      <!-- Product Cards -->
      ${productCards || noProductsFallback}

      <!-- Helpful Tip Box -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#F0E8D8;border-radius:14px;margin:20px 0 24px;">
        <tr>
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;vertical-align:top;">
                  <span style="font-size:20px;">💡</span>
                </td>
                <td style="vertical-align:top;">
                  <p style="margin:0;font-size:12px;color:#6B7A99;line-height:1.5;">
                    <strong style="color:#0D1B3E;">রিভিউ দিয়ে উপার্জন করুন!</strong><br>
                    প্রতিটি রিভিউয়ের জন্য আপনি পাবেন <strong style="color:#C47F11;">৫০ পয়েন্ট</strong>,
                    যা ভবিষ্যতের কেনাকাটায় ডিসকাউন্ট হিসেবে ব্যবহার করতে পারবেন।
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Security Note -->
      <p style="margin:0 0 24px;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.5;">
        🔒 এই লিংকগুলো শুধুমাত্র আপনার জন্য তৈরি। অন্যের সাথে শেয়ার করবেন না।<br>
        ⏰ লিংকের মেয়াদ: ৭ দিন
      </p>
      
    </td></tr>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- FOOTER SECTION -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0D1B3E;border-radius:0 0 24px 24px;">
        <tr>
          <td style="padding:24px 24px 20px;text-align:center;">
            <!-- Social Links -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;margin:0 6px;color:rgba(255,255,255,0.4);text-decoration:none;font-size:18px;">📘</a>
                  <a href="#" style="display:inline-block;margin:0 6px;color:rgba(255,255,255,0.4);text-decoration:none;font-size:18px;">📸</a>
                  <a href="#" style="display:inline-block;margin:0 6px;color:rgba(255,255,255,0.4);text-decoration:none;font-size:18px;">▶️</a>
                  <a href="#" style="display:inline-block;margin:0 6px;color:rgba(255,255,255,0.4);text-decoration:none;font-size:18px;">💬</a>
                </td>
              </tr>
            </table>
            
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">
              🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়
            </p>
            <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.3);">
              📞 হটলাইন: 09612 345678 | 📧 support@beeharvest.com
            </p>
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);">
              &copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Bottom Spacing -->
    <tr><td style="height:20px;"></td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Helper function to escape HTML special characters
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { generateReviewRequestEmail };
