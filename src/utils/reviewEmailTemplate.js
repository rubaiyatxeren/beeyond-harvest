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
      ({ productName, reviewUrl }) => `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFF9F0;border:1px solid #F0E8D8;
                  border-radius:14px;margin-bottom:12px;">
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#0D1B3E;">
                  ${productName}
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:#6B7A99;">
                  আপনার অভিজ্ঞতা শেয়ার করুন
                </p>
              </td>
              <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:12px;">
                <a href="${reviewUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#F5A623,#C47F11);
                          color:#0D1B3E;text-decoration:none;padding:10px 20px;
                          border-radius:50px;font-size:13px;font-weight:800;">
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

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>আপনার রিভিউ দিন — BeeHarvest</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#F5F0E8;padding:28px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

    <!-- HEADER -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:linear-gradient(135deg,#0D1B3E 0%,#1A2E5A 100%);
                    border-radius:24px 24px 0 0;">
        <tr>
          <td style="padding:36px 40px 20px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:linear-gradient(135deg,#F5A623,#C47F11);
                           border-radius:14px;width:52px;height:52px;
                           text-align:center;vertical-align:middle;
                           font-size:26px;line-height:52px;">🐝</td>
                <td style="padding-left:12px;text-align:left;vertical-align:middle;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">BeeHarvest</p>
                  <p style="margin:3px 0 0;font-size:11px;color:#FDD882;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</p>
                </td>
              </tr>
            </table>
            <div style="font-size:48px;margin-bottom:12px;">⭐</div>
            <h1 style="margin:0 0 10px;color:#fff;font-size:24px;font-weight:800;">
              আপনার মতামত আমাদের কাছে গুরুত্বপূর্ণ!
            </h1>
            <p style="margin:0 0 28px;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
              প্রিয় <strong style="color:#FDD882;">${order.customer.name}</strong>,
              আপনার অর্ডার <strong style="color:#FDD882;">${order.orderNumber}</strong>
              ডেলিভারি সম্পন্ন হয়েছে। আপনার রিভিউ অন্য ক্রেতাদের সিদ্ধান্ত নিতে সাহায্য করে।
            </p>
          </td>
        </tr>
        <tr>
          <td style="line-height:0;font-size:0;">
            <svg width="100%" height="40" viewBox="0 0 600 40"
                 preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 C150,40 450,0 600,40 L600,40 L0,40 Z" fill="#FFF9F0"/>
            </svg>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- BODY -->
    <tr><td style="background:#FFF9F0;padding:0 32px;">
      <p style="margin:28px 0 16px;font-size:14px;color:#374151;line-height:1.7;">
        নিচের প্রতিটি পণ্যের জন্য আলাদাভাবে রিভিউ দিতে পারবেন।
        প্রতিটি লিংক <strong>৭ দিন</strong> পর্যন্ত কার্যকর থাকবে।
      </p>

      ${productCards}

      <p style="margin:20px 0 28px;font-size:12px;color:#9CA3AF;text-align:center;">
        এই লিংকগুলো শুধুমাত্র আপনার জন্য তৈরি। অন্যের সাথে শেয়ার করবেন না।
      </p>
    </td></tr>

    <!-- FOOTER -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0D1B3E;border-radius:0 0 24px 24px;">
        <tr>
          <td style="padding:26px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.45);">
              🌾 BeeHarvest — সরাসরি ফার্ম থেকে আপনার দরজায়
            </p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
              &copy; ${year} BeeHarvest. সর্বস্বত্ব সংরক্ষিত।
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="height:28px;"></td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { generateReviewRequestEmail };
