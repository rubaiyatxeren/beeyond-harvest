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

  const statusConfig = {
    delivered: { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
    cancelled: { bg: "#FFEBEE", text: "#C62828", border: "#FFCDD2" },
    pending: { bg: "#FFF3E0", text: "#EF6C00", border: "#FFE0B2" },
    processing: { bg: "#E3F2FD", text: "#1565C0", border: "#BBDEFB" },
    shipped: { bg: "#F3E5F5", text: "#7B1FA2", border: "#E1BEE7" },
  };

  const status = statusConfig[order.orderStatus] || statusConfig.pending;

  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #F0F0F0;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />` : '<div style="width: 48px; height: 48px; background: #F5F5F5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🍽️</div>'}
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #1A1A1A; margin-bottom: 4px;">${item.name}</div>
                <div style="font-size: 13px; color: #666;">${item.price.toLocaleString()} ৳ each</div>
              </div>
            </div>
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #F0F0F0; text-align: center; font-weight: 500;">×${item.quantity}</td>
          <td style="padding: 16px 0; border-bottom: 1px solid #F0F0F0; text-align: right; font-weight: 700; color: #1A1A1A;">${item.total.toLocaleString()} ৳</td>
        </tr>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title}</title>
  <style>
    /* Modern reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background-color: #F5F7F5;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
      color: #1A1A1A;
    }
    
    /* Responsive container */
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    }
    
    /* Mobile-first responsive design */
    @media only screen and (max-width: 600px) {
      body {
        padding: 10px;
      }
      .container {
        border-radius: 16px;
      }
    }
    
    /* Typography */
    h1, h2, h3 {
      font-weight: 700;
      line-height: 1.3;
    }
    
    /* Button styles */
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%);
      color: #FFFFFF;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      text-align: center;
      transition: transform 0.2s ease;
    }
    
    .btn:hover {
      transform: translateY(-2px);
    }
    
    /* Responsive table */
    .responsive-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    @media only screen and (max-width: 480px) {
      .responsive-table thead {
        display: none;
      }
      .responsive-table tbody tr {
        display: block;
        margin-bottom: 20px;
        border: 1px solid #E0E0E0;
        border-radius: 12px;
        padding: 16px;
      }
      .responsive-table tbody td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border: none;
      }
      .responsive-table tbody td:before {
        content: attr(data-label);
        font-weight: 600;
        color: #666;
      }
    }
    
    /* Utility classes */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mt-20 { margin-top: 20px; }
    .mb-20 { margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Section -->
    <div style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); padding: 48px 32px; text-align: center;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 48px;">🌾</span>
      </div>
      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #FFFFFF; margin-bottom: 20px;">
        ${isNewOrder ? "ORDER CONFIRMED" : "ORDER UPDATE"}
      </div>
      <h1 style="color: #FFFFFF; font-size: 32px; margin-bottom: 16px;">
        ${isNewOrder ? "Thank You for Your Order!" : "Your Order Has Been Updated"}
      </h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 16px;">${message.replace(/<[^>]*>/g, "")}</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 40px 32px;">
      <!-- Greeting -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 24px; color: #1A1A1A; margin-bottom: 8px;">Hello, ${order.customer.name}!</h2>
        <p style="color: #666;">${isNewOrder ? "We're thrilled to confirm your order. Here's everything you need to know:" : "Here's the latest information about your order:"}</p>
      </div>
      
      <!-- Order Status Card -->
      <div style="background: ${status.bg}; border-left: 4px solid ${status.text}; padding: 20px; border-radius: 12px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: ${status.text}; margin-bottom: 4px;">Current Status</div>
            <div style="font-size: 20px; font-weight: 700; color: ${status.text};">${order.orderStatus.toUpperCase()}</div>
          </div>
          <div style="background: ${status.text}; color: white; padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 600;">
            Order #${order.orderNumber}
          </div>
        </div>
      </div>
      
      <!-- Order Details Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 32px;">
        <div style="background: #F8F9F8; padding: 16px; border-radius: 12px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Order Date</div>
          <div style="font-weight: 600;">${new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style="background: #F8F9F8; padding: 16px; border-radius: 12px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Payment Method</div>
          <div style="font-weight: 600;">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : order.paymentMethod}</div>
        </div>
        <div style="background: #F8F9F8; padding: 16px; border-radius: 12px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Payment Status</div>
          <div style="font-weight: 600; color: ${order.paymentStatus === "paid" ? "#2E7D32" : "#EF6C00"};">${order.paymentStatus === "paid" ? "✓ Paid" : "Pending"}</div>
        </div>
        ${
          order.trackingNumber
            ? `
        <div style="background: #F8F9F8; padding: 16px; border-radius: 12px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Tracking Number</div>
          <div style="font-weight: 600; font-size: 14px;">${order.trackingNumber}</div>
        </div>
        `
            : ""
        }
      </div>
      
      <!-- Shipping Address -->
      <div style="background: #F8F9F8; padding: 20px; border-radius: 12px; margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 20px;">📍</span>
          <h3 style="font-size: 16px;">Shipping Address</h3>
        </div>
        <p style="color: #333; line-height: 1.5;">
          ${order.customer.address?.street || "N/A"}<br>
          ${[order.customer.address?.area, order.customer.address?.city].filter(Boolean).join(", ")}<br>
          Phone: ${order.customer.phone}
        </p>
      </div>
      
      <!-- Order Items -->
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 18px; margin-bottom: 16px;">Order Items</h3>
        <table class="responsive-table" style="width: 100%;">
          <thead>
            <tr style="background: #F8F9F8;">
              <th style="padding: 12px; text-align: left;">Product</th>
              <th style="padding: 12px; text-align: center;">Quantity</th>
              <th style="padding: 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      
      <!-- Order Summary -->
      <div style="background: #1A1A1A; padding: 24px; border-radius: 16px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: rgba(255,255,255,0.6);">Subtotal</span>
          <span style="color: white;">${order.subtotal.toLocaleString()} ৳</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: rgba(255,255,255,0.6);">Delivery Charge</span>
          <span style="color: white;">${order.deliveryCharge.toLocaleString()} ৳</span>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0;"></div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 18px; font-weight: 600; color: #4CAF50;">Total Amount</span>
          <span style="font-size: 24px; font-weight: 700; color: #4CAF50;">${order.total.toLocaleString()} ৳</span>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div class="text-center">
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/orders/${order._id}" class="btn" style="color: white;">View Full Order Details →</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #F8F9F8; padding: 32px; text-align: center; border-top: 1px solid #E0E0E0;">
      <p style="color: #666; font-size: 13px; margin-bottom: 8px;">
        🌱 Beeyond Harvest — Fresh from farm to your doorstep
      </p>
      <p style="color: #999; font-size: 12px;">
        Need assistance? <a href="mailto:support@beeyondharvest.com" style="color: #4CAF50; text-decoration: none;">support@beeyondharvest.com</a>
      </p>
      <p style="color: #999; font-size: 11px; margin-top: 16px;">
        © ${new Date().getFullYear()} Beeyond Harvest. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
};

const generateAdminEmailTemplate = (order, type = "new_order") => {
  const isNew = type === "new_order";
  const title = isNew ? "🛍️ New Order Received" : "📦 Order Status Changed";
  const tagLabel = isNew ? "NEW ORDER ALERT" : "STATUS UPDATE";

  const statusConfig = {
    delivered: {
      bg: "#E8F5E9",
      text: "#2E7D32",
      border: "#A5D6A7",
      icon: "✅",
    },
    cancelled: {
      bg: "#FFEBEE",
      text: "#C62828",
      border: "#FFCDD2",
      icon: "❌",
    },
    pending: { bg: "#FFF3E0", text: "#EF6C00", border: "#FFE0B2", icon: "⏳" },
    processing: {
      bg: "#E3F2FD",
      text: "#1565C0",
      border: "#BBDEFB",
      icon: "⚙️",
    },
    shipped: { bg: "#F3E5F5", text: "#7B1FA2", border: "#E1BEE7", icon: "🚚" },
  };

  const status = statusConfig[order.orderStatus] || statusConfig.pending;

  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #F0F0F0;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; background: #F5F5F5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🛒</div>
              <div>
                <div style="font-weight: 600; color: #1A1A1A;">${item.name}</div>
                <div style="font-size: 12px; color: #666;">Qty: ${item.quantity} × ${item.price.toLocaleString()} ৳</div>
              </div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #F0F0F0; text-align: right; font-weight: 700;">${item.total.toLocaleString()} ৳</td>
        </tr>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title} - Beeyond Harvest Admin</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background-color: #F0F2F5;
      margin: 0;
      padding: 20px;
      line-height: 1.5;
      color: #1A1A1A;
    }
    
    .container {
      max-width: 650px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    
    @media only screen and (max-width: 600px) {
      body {
        padding: 10px;
      }
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #F0F0F0;
    }
    
    @media only screen and (max-width: 480px) {
      .info-row {
        flex-direction: column;
        gap: 4px;
      }
      .responsive-grid {
        grid-template-columns: 1fr !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1A1A2E 0%, #16213E 100%); padding: 40px 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">${isNew ? "🛍️" : "📦"}</div>
        <div style="background: rgba(255,255,255,0.15); display: inline-block; padding: 4px 16px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 1px; color: #A78BFA; margin-bottom: 16px;">
          ${tagLabel}
        </div>
        <h1 style="color: #FFFFFF; font-size: 28px; margin-bottom: 8px;">${isNew ? "New Order Received!" : "Order Status Updated"}</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Order #${order.orderNumber}</p>
      </div>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <!-- Quick Stats -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 32px;" class="responsive-grid">
        <div style="background: #F8F9FA; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 4px;">💰</div>
          <div style="font-size: 20px; font-weight: 700; color: #1A1A2E;">${order.total.toLocaleString()} ৳</div>
          <div style="font-size: 11px; color: #666;">Total Amount</div>
        </div>
        <div style="background: #F8F9FA; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 4px;">📦</div>
          <div style="font-size: 20px; font-weight: 700; color: #1A1A2E;">${order.items.length}</div>
          <div style="font-size: 11px; color: #666;">Items</div>
        </div>
        <div style="background: #F8F9FA; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 4px;">${status.icon}</div>
          <div style="font-size: 14px; font-weight: 700; color: ${status.text};">${order.orderStatus.toUpperCase()}</div>
          <div style="font-size: 11px; color: #666;">Current Status</div>
        </div>
      </div>
      
      <!-- Customer Information -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <span>👤</span> Customer Information
        </h2>
        <div style="background: #F8F9FA; padding: 20px; border-radius: 12px;">
          <div class="info-row">
            <span style="color: #666;">Customer Name</span>
            <span style="font-weight: 600;">${order.customer.name}</span>
          </div>
          <div class="info-row">
            <span style="color: #666;">Email Address</span>
            <span style="font-weight: 600;">${order.customer.email}</span>
          </div>
          <div class="info-row">
            <span style="color: #666;">Phone Number</span>
            <span style="font-weight: 600;">${order.customer.phone}</span>
          </div>
          <div class="info-row" style="border-bottom: none;">
            <span style="color: #666;">Delivery Address</span>
            <span style="font-weight: 600; text-align: right; flex: 1; margin-left: 20px;">
              ${order.customer.address?.street || "N/A"}<br>
              ${[order.customer.address?.area, order.customer.address?.city].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Order Details -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <span>ℹ️</span> Order Details
        </h2>
        <div style="background: #F8F9FA; padding: 20px; border-radius: 12px;">
          <div class="info-row">
            <span style="color: #666;">Payment Method</span>
            <span style="font-weight: 600;">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : order.paymentMethod}</span>
          </div>
          <div class="info-row">
            <span style="color: #666;">Payment Status</span>
            <span style="font-weight: 600; color: ${order.paymentStatus === "paid" ? "#2E7D32" : "#EF6C00"};">${order.paymentStatus === "paid" ? "✓ Paid" : "Pending"}</span>
          </div>
          <div class="info-row">
            <span style="color: #666;">Order Date</span>
            <span style="font-weight: 600;">${new Date(order.createdAt).toLocaleString()}</span>
          </div>
          ${
            order.trackingNumber
              ? `
          <div class="info-row" style="border-bottom: none;">
            <span style="color: #666;">Tracking Number</span>
            <span style="font-weight: 600;">${order.trackingNumber}</span>
          </div>
          `
              : ""
          }
        </div>
      </div>
      
      <!-- Order Items -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <span>🛍️</span> Order Items
        </h2>
        <div style="border: 1px solid #F0F0F0; border-radius: 12px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #F8F9FA; border-bottom: 1px solid #F0F0F0;">
                <th style="padding: 12px; text-align: left;">Product</th>
                <th style="padding: 12px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background: #F8F9FA;">
                <td style="padding: 16px 12px; font-weight: 600;">Subtotal</td>
                <td style="padding: 16px 12px; text-align: right; font-weight: 600;">${order.subtotal.toLocaleString()} ৳</td>
              </tr>
              <tr style="background: #F8F9FA;">
                <td style="padding: 12px; font-weight: 600;">Delivery Charge</td>
                <td style="padding: 12px; text-align: right; font-weight: 600;">${order.deliveryCharge.toLocaleString()} ৳</td>
              </tr>
              <tr style="background: #1A1A2E;">
                <td style="padding: 16px 12px; font-weight: 700; color: #A78BFA; font-size: 16px;">GRAND TOTAL</td>
                <td style="padding: 16px 12px; text-align: right; font-weight: 700; color: #A78BFA; font-size: 20px;">${order.total.toLocaleString()} ৳</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}" style="flex: 1; background: #1A1A2E; color: white; text-decoration: none; padding: 14px; text-align: center; border-radius: 12px; font-weight: 600;">
          📋 View Full Order
        </a>
        <a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}/edit" style="flex: 1; background: #4CAF50; color: white; text-decoration: none; padding: 14px; text-align: center; border-radius: 12px; font-weight: 600;">
          ✏️ Update Status
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #F8F9FA; padding: 24px; text-align: center; border-top: 1px solid #E0E0E0;">
      <p style="color: #666; font-size: 12px;">
        Beeyond Harvest Admin System — Automated Notification
      </p>
      <p style="color: #999; font-size: 11px; margin-top: 8px;">
        © ${new Date().getFullYear()} Beeyond Harvest. All rights reserved.
      </p>
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
