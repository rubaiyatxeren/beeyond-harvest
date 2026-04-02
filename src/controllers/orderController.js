const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendEmail } = require("../utils/emailService");

// ─── Email Templates ──────────────────────────────────────────────────────────

const generateOrderEmailTemplate = (order, type = "new_order") => {
  const isNewOrder = type === "new_order";
  const title = isNewOrder
    ? "Order Confirmed - Beeyond Harvest"
    : "Order Update - Beeyond Harvest";
  const message = isNewOrder
    ? "Thank you for choosing Beeyond Harvest. Your order has been received and is being prepared with care."
    : `Your order status has been updated to <strong>${order.orderStatus.toUpperCase()}</strong>.`;

  const statusColor =
    order.orderStatus === "delivered"
      ? "#4aa334"
      : order.orderStatus === "cancelled"
        ? "#dc2626"
        : "#d97706";

  const statusBg =
    order.orderStatus === "delivered"
      ? "#d1fae5"
      : order.orderStatus === "cancelled"
        ? "#fee2e2"
        : "#fef3c7";

  const statusText =
    order.orderStatus === "delivered"
      ? "#065f46"
      : order.orderStatus === "cancelled"
        ? "#991b1b"
        : "#92400e";

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #e8f0e8;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 7px; height: 7px; border-radius: 50%; background: #4aa334; flex-shrink: 0;"></div>
          <span style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #1a2e1b; font-weight: 500;">${item.name}</span>
        </div>
      </td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e8f0e8; text-align: center; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #6b8c6c;">×${item.quantity}</td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e8f0e8; text-align: right; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #6b8c6c;">${item.price.toLocaleString()} ৳</td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e8f0e8; text-align: right; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #1a2e1b; font-weight: 500;">${item.total.toLocaleString()} ৳</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #eef2ee;
      margin: 0;
      padding: 28px 16px;
    }
    .wrapper { max-width: 620px; margin: 0 auto; }

    /* HERO */
    .hero {
      background: #0d1f0f;
      border-radius: 20px 20px 0 0;
      padding: 40px 40px 36px;
      position: relative;
      overflow: hidden;
    }
    .hero-glow-1 {
      position: absolute; top: -40px; right: -40px;
      width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle, rgba(74,163,52,0.2) 0%, transparent 70%);
    }
    .hero-glow-2 {
      position: absolute; bottom: -60px; left: -20px;
      width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, rgba(122,202,93,0.12) 0%, transparent 70%);
    }
    .logo-row {
      display: flex; align-items: center; gap: 11px;
      margin-bottom: 30px; position: relative; z-index: 1;
    }
    .logo-icon {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #4aa334, #7aca5d);
      border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .logo-name {
      font-family: 'Playfair Display', Georgia, serif;
      color: #ffffff; font-size: 19px; font-weight: 600;
      letter-spacing: 0.3px;
    }
    .hero-pill {
      display: inline-block;
      background: rgba(74,163,52,0.18);
      border: 1px solid rgba(74,163,52,0.38);
      color: #7aca5d;
      font-size: 11px; font-weight: 500;
      letter-spacing: 1.6px; text-transform: uppercase;
      padding: 5px 13px; border-radius: 100px;
      margin-bottom: 16px; position: relative; z-index: 1;
    }
    .hero-headline {
      font-family: 'Playfair Display', Georgia, serif;
      color: #ffffff; font-size: 36px; font-weight: 700;
      line-height: 1.18; position: relative; z-index: 1;
    }
    .hero-headline .accent { color: #7aca5d; }
    .hero-sub {
      color: rgba(255,255,255,0.5);
      font-size: 14px; font-weight: 300;
      margin-top: 12px; line-height: 1.6;
      position: relative; z-index: 1;
    }

    /* BODY */
    .body { background: #f6f9f6; padding: 34px 40px; }
    .greeting { font-size: 17px; color: #1a2e1b; font-weight: 400; margin-bottom: 6px; }
    .greeting strong { font-weight: 600; }
    .sub-message { font-size: 14px; color: #5a7a5c; line-height: 1.65; margin-bottom: 30px; }

    /* ORDER CARD */
    .card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #ddeedd;
      padding: 22px 24px;
      margin-bottom: 18px;
    }
    .card-label {
      font-size: 11px; letter-spacing: 1.5px;
      text-transform: uppercase; color: #8aab8b;
      font-weight: 500; margin-bottom: 16px;
    }
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }
    .info-item .label {
      font-size: 12px; color: #8aab8b; margin-bottom: 4px;
    }
    .info-item .value {
      font-size: 14px; color: #1a2e1b; font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 11px; border-radius: 100px;
      font-size: 11px; font-weight: 500;
      letter-spacing: 0.8px; text-transform: uppercase;
      background: ${statusBg}; color: ${statusText};
    }

    /* ITEMS TABLE */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead tr th {
      font-size: 11px; letter-spacing: 1.2px;
      text-transform: uppercase; color: #8aab8b;
      font-weight: 500; padding-bottom: 10px;
      border-bottom: 1px solid #ddeedd;
    }
    .items-table thead tr th:first-child { text-align: left; }
    .items-table thead tr th:not(:first-child) { text-align: right; }
    .items-table thead tr th:nth-child(2) { text-align: center; }

    /* TOTALS */
    .totals {
      background: #0d1f0f; border-radius: 14px;
      padding: 20px 24px; margin-bottom: 26px;
    }
    .total-row {
      display: flex; justify-content: space-between;
      padding: 6px 0;
    }
    .total-row .tl { color: rgba(255,255,255,0.45); font-size: 13px; }
    .total-row .tr { color: rgba(255,255,255,0.7); font-size: 13px; }
    .total-row.grand { border-top: 1px solid rgba(255,255,255,0.1); margin-top: 10px; padding-top: 14px; }
    .total-row.grand .tl { color: #7aca5d; font-size: 14px; font-weight: 500; }
    .total-row.grand .tr {
      color: #ffffff; font-size: 20px; font-weight: 700;
      font-family: 'Playfair Display', Georgia, serif;
    }

    /* CTA */
    .cta-wrap { text-align: center; margin-bottom: 4px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #2d6a1f 0%, #4aa334 100%);
      color: #ffffff; padding: 15px 36px;
      border-radius: 12px; text-decoration: none;
      font-size: 14px; font-weight: 500;
      letter-spacing: 0.3px;
    }

    /* FOOTER */
    .footer {
      background: #0d1f0f; border-radius: 0 0 20px 20px;
      padding: 26px 40px; text-align: center;
    }
    .footer p { color: rgba(255,255,255,0.35); font-size: 12px; line-height: 2; }
    .footer a { color: #7aca5d; text-decoration: none; }

    @media (max-width: 480px) {
      .hero { padding: 30px 24px 28px; }
      .body { padding: 26px 24px; }
      .hero-headline { font-size: 28px; }
      .info-grid { grid-template-columns: 1fr; }
      .footer { padding: 22px 24px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- HERO -->
    <div class="hero">
      <div class="hero-glow-1"></div>
      <div class="hero-glow-2"></div>
      <div class="logo-row">
        <div class="logo-icon">🌾</div>
        <span class="logo-name">Beeyond Harvest</span>
      </div>
      <div class="hero-pill">${isNewOrder ? "Order confirmed" : "Order update"}</div>
      <div class="hero-headline">
        ${isNewOrder ? "Your fresh harvest<br>is on its <span class='accent'>way.</span>" : "Your order has<br>been <span class='accent'>updated.</span>"}
      </div>
      <div class="hero-sub">${message}</div>
    </div>

    <!-- BODY -->
    <div class="body">
      <p class="greeting">Hello, <strong>${order.customer.name}</strong></p>
      <p class="sub-message">
        ${
          isNewOrder
            ? "We've received your order and it's in good hands. Here's a summary of everything you ordered."
            : "Here's the latest on your order — see all the details below."
        }
      </p>

      <!-- Order details card -->
      <div class="card">
        <div class="card-label">Order details</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Order number</div>
            <div class="value">${order.orderNumber}</div>
          </div>
          <div class="info-item">
            <div class="label">Order date</div>
            <div class="value">${new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <div class="info-item">
            <div class="label">Status</div>
            <div class="value"><span class="status-badge">${order.orderStatus}</span></div>
          </div>
          <div class="info-item">
            <div class="label">Payment method</div>
            <div class="value">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : order.paymentMethod}</div>
          </div>
          <div class="info-item">
            <div class="label">Payment status</div>
            <div class="value">${order.paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}</div>
          </div>
          ${
            order.trackingNumber
              ? `
          <div class="info-item">
            <div class="label">Tracking number</div>
            <div class="value">${order.trackingNumber}</div>
          </div>`
              : ""
          }
        </div>
      </div>

      <!-- Items card -->
      <div class="card">
        <div class="card-label">Items ordered</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align:left;">Product</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="totals">
        <div class="total-row"><span class="tl">Subtotal</span><span class="tr">${order.subtotal.toLocaleString()} ৳</span></div>
        <div class="total-row"><span class="tl">Delivery charge</span><span class="tr">${order.deliveryCharge.toLocaleString()} ৳</span></div>
        <div class="total-row grand"><span class="tl">Total amount</span><span class="tr">${order.total.toLocaleString()} ৳</span></div>
      </div>

      <!-- CTA -->
      <div class="cta-wrap">
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/orders/${order._id}" class="cta-btn">View order details &rarr;</a>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>Beeyond Harvest &mdash; Fresh from farm to your doorstep 🌱</p>
      <p>Need help? <a href="mailto:support@beeyondharvest.com">support@beeyondharvest.com</a></p>
      <p>&copy; ${new Date().getFullYear()} Beeyond Harvest. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const generateAdminEmailTemplate = (order, type = "new_order") => {
  const isNew = type === "new_order";
  const title = isNew ? "New order received" : "Order status changed";
  const tagLabel = isNew ? "New order" : "Status update";

  const statusBg =
    order.orderStatus === "delivered"
      ? "#d1fae5"
      : order.orderStatus === "cancelled"
        ? "#fee2e2"
        : "#fef3c7";
  const statusText =
    order.orderStatus === "delivered"
      ? "#065f46"
      : order.orderStatus === "cancelled"
        ? "#991b1b"
        : "#92400e";

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 13px 20px; border-bottom: 1px solid #f0f0f8;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #a78bfa; flex-shrink: 0;"></div>
          <div>
            <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #1a1a2e; font-weight: 500;">${item.name}</div>
            <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #9ca3af; margin-top: 2px;">Qty: ${item.quantity}</div>
          </div>
        </div>
      </td>
      <td style="padding: 13px 20px; border-bottom: 1px solid #f0f0f8; text-align: right; vertical-align: middle;">
        <span style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #1a1a2e; font-weight: 500;">${item.total.toLocaleString()} ৳</span>
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Beeyond Harvest Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #ededf8;
      margin: 0; padding: 28px 16px;
    }
    .wrapper { max-width: 620px; margin: 0 auto; }

    /* HERO */
    .hero {
      background: #1a1a2e; border-radius: 20px 20px 0 0;
      padding: 34px 40px;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .hero-left .tag {
      font-size: 11px; letter-spacing: 1.6px;
      text-transform: uppercase; color: #a78bfa;
      font-weight: 500; margin-bottom: 9px;
    }
    .hero-left h1 {
      font-family: 'Playfair Display', Georgia, serif;
      color: #ffffff; font-size: 27px; font-weight: 600;
    }
    .order-pill {
      background: rgba(167,139,250,0.14);
      border: 1px solid rgba(167,139,250,0.32);
      color: #a78bfa; padding: 9px 16px;
      border-radius: 10px; font-size: 13px;
      font-weight: 500; white-space: nowrap;
      letter-spacing: 0.3px;
    }

    /* BODY */
    .body { background: #f8f8fc; padding: 30px 40px; }

    /* CARDS GRID */
    .cards-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      margin-bottom: 18px;
    }
    .info-card {
      background: #ffffff; border-radius: 12px;
      border: 1px solid #e8e8f0; padding: 16px 18px;
    }
    .info-card .label {
      font-size: 11px; letter-spacing: 1.3px;
      text-transform: uppercase; color: #9ca3af;
      font-weight: 500; margin-bottom: 6px;
    }
    .info-card .val {
      font-size: 14px; color: #1a1a2e; font-weight: 500;
    }
    .info-card .sub {
      font-size: 12px; color: #9ca3af; margin-top: 3px;
    }

    /* ADDRESS */
    .address-card {
      background: #ffffff; border-radius: 12px;
      border: 1px solid #e8e8f0; padding: 18px;
      margin-bottom: 18px;
      display: flex; align-items: flex-start; gap: 14px;
    }
    .addr-icon {
      width: 38px; height: 38px;
      background: #f0eeff; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    .addr-label {
      font-size: 11px; letter-spacing: 1.3px;
      text-transform: uppercase; color: #9ca3af;
      font-weight: 500; margin-bottom: 6px;
    }
    .addr-text { font-size: 14px; color: #1a1a2e; line-height: 1.55; }

    /* ITEMS BOX */
    .items-box {
      background: #ffffff; border-radius: 12px;
      border: 1px solid #e8e8f0; overflow: hidden;
      margin-bottom: 18px;
    }
    .items-head {
      padding: 14px 20px; border-bottom: 1px solid #f0f0f8;
      display: flex; justify-content: space-between; align-items: center;
    }
    .items-head .h-label {
      font-size: 11px; letter-spacing: 1.3px;
      text-transform: uppercase; color: #9ca3af; font-weight: 500;
    }
    .items-head .h-count {
      font-size: 12px; color: #9ca3af;
    }
    .items-table { width: 100%; border-collapse: collapse; }

    /* SUMMARY BAR */
    .summary-bar {
      background: #1a1a2e; border-radius: 12px;
      padding: 20px 24px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .sum-item .s-label {
      font-size: 11px; letter-spacing: 1.3px;
      text-transform: uppercase; color: rgba(255,255,255,0.35);
      font-weight: 500; margin-bottom: 6px;
    }
    .sum-item .s-val {
      font-size: 16px; color: rgba(255,255,255,0.85); font-weight: 500;
    }
    .sum-item.highlight .s-val {
      color: #a78bfa; font-size: 22px; font-weight: 700;
      font-family: 'Playfair Display', Georgia, serif;
    }

    /* CTA ROW */
    .cta-row {
      display: flex; gap: 12px; margin-bottom: 4px;
    }
    .btn-primary {
      flex: 1; display: block; text-align: center;
      background: #1a1a2e; color: #ffffff;
      padding: 14px; border-radius: 11px;
      text-decoration: none; font-size: 13px; font-weight: 500;
    }
    .btn-secondary {
      flex: 1; display: block; text-align: center;
      background: #ffffff; color: #1a1a2e;
      padding: 14px; border-radius: 11px;
      text-decoration: none; font-size: 13px; font-weight: 500;
      border: 1px solid #e8e8f0;
    }

    /* FOOTER */
    .footer {
      background: #1a1a2e; border-radius: 0 0 20px 20px;
      padding: 20px 40px; text-align: center;
    }
    .footer p {
      color: rgba(255,255,255,0.28);
      font-size: 11px; letter-spacing: 0.3px; line-height: 1.9;
    }

    @media (max-width: 480px) {
      .hero { flex-direction: column; gap: 16px; padding: 26px 24px; }
      .body { padding: 24px; }
      .cards-grid { grid-template-columns: 1fr; }
      .cta-row { flex-direction: column; }
      .footer { padding: 18px 24px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- HERO -->
    <div class="hero">
      <div class="hero-left">
        <div class="tag">${tagLabel}</div>
        <h1>${title}</h1>
      </div>
      <div class="order-pill">${order.orderNumber}</div>
    </div>

    <!-- BODY -->
    <div class="body">

      <!-- Info grid -->
      <div class="cards-grid">
        <div class="info-card">
          <div class="label">Customer</div>
          <div class="val">${order.customer.name}</div>
          <div class="sub">${order.customer.phone}</div>
        </div>
        <div class="info-card">
          <div class="label">Email</div>
          <div class="val" style="font-size:13px; word-break: break-all;">${order.customer.email}</div>
        </div>
        <div class="info-card">
          <div class="label">Payment</div>
          <div class="val">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : order.paymentMethod}</div>
        </div>
        <div class="info-card">
          <div class="label">Status</div>
          <div class="val">
            <span style="background:${statusBg}; color:${statusText}; font-size:11px; padding:3px 10px; border-radius:100px; font-weight:500; letter-spacing:0.8px; text-transform:uppercase;">
              ${order.orderStatus}
            </span>
          </div>
        </div>
      </div>

      <!-- Address -->
      <div class="address-card">
        <div class="addr-icon">📍</div>
        <div>
          <div class="addr-label">Delivery address</div>
          <div class="addr-text">
            ${order.customer.address?.street || "N/A"}<br>
            ${[order.customer.address?.area, order.customer.address?.city].filter(Boolean).join(", ")}
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="items-box">
        <div class="items-head">
          <span class="h-label">Items ordered</span>
          <span class="h-count">${order.items.length} product${order.items.length !== 1 ? "s" : ""}</span>
        </div>
        <table class="items-table">
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="sum-item">
          <div class="s-label">Subtotal</div>
          <div class="s-val">${order.subtotal.toLocaleString()} ৳</div>
        </div>
        <div class="sum-item">
          <div class="s-label">Delivery</div>
          <div class="s-val">${order.deliveryCharge.toLocaleString()} ৳</div>
        </div>
        <div class="sum-item highlight">
          <div class="s-label">Total</div>
          <div class="s-val">${order.total.toLocaleString()} ৳</div>
        </div>
      </div>

      <!-- CTAs -->
      <div class="cta-row">
        <a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}" class="btn-primary">Open in admin panel &rarr;</a>
        <a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}/edit" class="btn-secondary">Update order status</a>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>Beeyond Harvest Admin System &middot; Auto-generated notification &middot; Do not reply</p>
      <p>&copy; ${new Date().getFullYear()} Beeyond Harvest. All rights reserved.</p>
    </div>
  </div>
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
    console.log("📦 [ORDER] Body:", JSON.stringify(req.body, null, 2));

    const { items, customer, paymentMethod, deliveryCharge } = req.body;

    if (!items || !items.length) {
      console.warn("⚠️  [ORDER] Rejected — no items");
      return res
        .status(400)
        .json({ success: false, message: "No items in order" });
    }
    if (!customer || !customer.name || !customer.email || !customer.phone) {
      console.warn("⚠️  [ORDER] Rejected — missing customer fields:", {
        name: !!customer?.name,
        email: !!customer?.email,
        phone: !!customer?.phone,
      });
      return res
        .status(400)
        .json({ success: false, message: "Customer information is required" });
    }

    console.log(
      `👤 [ORDER] Customer: ${customer.name} <${customer.email}> | ${customer.phone}`,
    );
    console.log(`🛒 [ORDER] Items count: ${items.length}`);

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      console.log(`🔍 [ORDER] Looking up product: ${item.product}`);
      const product = await Product.findById(item.product);

      if (!product) {
        console.error(`❌ [ORDER] Product not found: ${item.product}`);
        return res.status(404).json({
          success: false,
          message: `Product ${item.product} not found`,
        });
      }
      if (product.stock < item.quantity) {
        console.warn(
          `⚠️  [ORDER] Insufficient stock — "${product.name}" has ${product.stock}, requested ${item.quantity}`,
        );
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      const total = product.price * item.quantity;
      subtotal += total;
      orderItems.push({
        product: item.product,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: product.price,
        total,
      });
      console.log(`   ✅ ${product.name} x${item.quantity} = ${total} ৳`);
    }

    const total = subtotal + (deliveryCharge || 60);
    console.log(
      `💰 [ORDER] Subtotal: ${subtotal} ৳ | Delivery: ${deliveryCharge || 60} ৳ | Total: ${total} ৳`,
    );

    const date = new Date();
    const count = await Order.countDocuments();
    const orderNumber = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(5, "0")}`;
    console.log(`🔢 [ORDER] Generated order number: ${orderNumber}`);

    console.log("💾 [ORDER] Saving to database...");
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
    console.log(`✅ [ORDER] Saved — ID: ${order._id}`);

    console.log("📦 [ORDER] Updating product stock...");
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }
    console.log("✅ [ORDER] Stock updated");

    console.log(
      `🎉 [ORDER] ${orderNumber} created successfully — responding to client`,
    );
    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully.",
    });

    // 🔔 Background emails
    if (process.env.DISABLE_EMAIL === "true") {
      console.log("📧 [EMAIL] Skipped — DISABLE_EMAIL=true");
      return;
    }

    setImmediate(async () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(
        `📧 [EMAIL] Starting background email job for ${orderNumber}`,
      );

      try {
        // Customer email
        console.log(
          `📧 [EMAIL] Sending confirmation to customer: ${order.customer.email}`,
        );
        const customerResult = await sendEmail(
          order.customer.email,
          `🎉 Order Confirmed - ${order.orderNumber}`,
          generateOrderEmailTemplate(order, "new_order"),
        );
        if (customerResult?.success) {
          console.log(
            `✅ [EMAIL] Customer email sent → ${order.customer.email}`,
          );
        } else {
          console.error(
            `❌ [EMAIL] Customer email FAILED → ${order.customer.email}`,
          );
          console.error(`   Reason: ${customerResult?.error}`);
        }

        // Admin emails
        const adminEmails = (
          process.env.ADMIN_EMAILS || "ygstudiobd@gmail.com"
        ).split(",");
        console.log(
          `📧 [EMAIL] Sending admin notification to: ${adminEmails.join(", ")}`,
        );
        const adminHtml = generateAdminEmailTemplate(order, "new_order");

        for (const email of adminEmails) {
          const adminResult = await sendEmail(
            email.trim(),
            `🆕 New Order #${order.orderNumber} - Action Required`,
            adminHtml,
          );
          if (adminResult?.success) {
            console.log(`✅ [EMAIL] Admin email sent → ${email.trim()}`);
          } else {
            console.error(`❌ [EMAIL] Admin email FAILED → ${email.trim()}`);
            console.error(`   Reason: ${adminResult?.error}`);
          }
        }

        console.log(`📧 [EMAIL] Job complete for ${orderNumber}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } catch (emailError) {
        console.error(
          "❌ [EMAIL] Unexpected error in background job:",
          emailError.message,
        );
        console.error(emailError.stack);
      }
    });
  } catch (error) {
    console.error("❌ [ORDER] Create order crashed:", error.message);
    console.error(error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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

    console.log(
      `📋 [ORDERS] Fetching page ${page}, limit ${limit}, query:`,
      JSON.stringify(query),
    );
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("items.product", "name images")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);
    console.log(`✅ [ORDERS] Returned ${orders.length}/${total} orders`);

    res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("❌ [ORDERS] Get orders error:", error.message);
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
      console.warn(`⚠️  [ORDER] Not found: ${req.params.id}`);
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
      console.warn(`⚠️  [STATUS] Order not found: ${req.params.id}`);
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
    if (req.body.deliveryPartner)
      order.deliveryPartner = req.body.deliveryPartner;

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
          `📧 [EMAIL] Sending status update email for ${order.orderNumber} → ${newStatus}`,
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
              `❌ [EMAIL] Status email FAILED → ${order.customer.email}: ${result?.error}`,
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
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
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
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
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

    console.log(
      `📧 [MANUAL EMAIL] Sending to: ${order.customer.email}, subject: "${subject || "default"}"`,
    );
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
        $group: { _id: groupBy, total: { $sum: "$total" }, count: { $sum: 1 } },
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
// @access  Public - NO AUTH REQUIRED
const getOrdersByPhone = async (req, res) => {
  try {
    const phoneNumber = req.params.phone;

    // Validate Bangladeshi phone number
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Valid Bangladeshi phone number required (01XXXXXXXXX)",
      });
    }

    console.log(
      `📞 [PUBLIC PHONE SEARCH] Looking for orders with phone: ${cleanPhone}`,
    );

    // Find orders with this phone number
    // Only return necessary fields (no sensitive data)
    const orders = await Order.find({
      "customer.phone": {
        $regex: `${cleanPhone}$|${cleanPhone.slice(-11)}$`,
        $options: "i",
      },
    })
      .select(
        "orderNumber customer.name customer.phone items.name items.quantity items.price items.total subtotal deliveryCharge total paymentMethod orderStatus createdAt trackingNumber",
      )
      .sort("-createdAt")
      .limit(50); // Limit to last 50 orders for performance

    // Remove sensitive customer email from response (optional)
    const sanitizedOrders = orders.map((order) => {
      const orderObj = order.toObject();
      delete orderObj.customer?.email; // Don't expose email publicly
      return orderObj;
    });

    console.log(
      `✅ [PUBLIC PHONE SEARCH] Found ${sanitizedOrders.length} orders for ${cleanPhone}`,
    );

    res.json({
      success: true,
      count: sanitizedOrders.length,
      data: sanitizedOrders,
    });
  } catch (error) {
    console.error("❌ [PUBLIC PHONE SEARCH] Error:", error.message);
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
  getOrdersByPhone, // Add this
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  getSalesAnalytics,
  sendManualOrderEmail,
};
