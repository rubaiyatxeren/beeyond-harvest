const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendEmail } = require("../utils/emailService");

// ─── Email Templates ──────────────────────────────────────────────────────────

const generateOrderEmailTemplate = (order, type = "new_order") => {
  const isNewOrder = type === "new_order";
  const title = isNewOrder
    ? "🎉 New Order Received!"
    : "📦 Order Status Update";
  const message = isNewOrder
    ? "Thank you for your order! We'll process it shortly."
    : `Your order status has been updated to: ${order.orderStatus.toUpperCase()}`;

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">${item.name}</td>
      <td style="padding: 12px; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; text-align: right;">${item.price.toLocaleString()} ৳</td>
      <td style="padding: 12px; text-align: right;">${item.total.toLocaleString()} ৳</td>
    </tr>`,
    )
    .join("");

  const statusColor =
    order.orderStatus === "delivered"
      ? "#10b981"
      : order.orderStatus === "cancelled"
        ? "#ef4444"
        : "#f59e0b";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Beeyond Harvest</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
    .content { padding: 32px 24px; }
    .order-info { background: #f9fafb; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .order-info h3 { margin: 0 0 12px 0; color: #1f2937; font-size: 16px; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { font-size: 14px; }
    .info-label { color: #6b7280; font-weight: 500; margin-bottom: 4px; }
    .info-value { color: #1f2937; font-weight: 600; }
    .status-badge { display: inline-block; padding: 6px 12px; background: ${statusColor}; color: white; border-radius: 100px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; }
    .totals { background: #f9fafb; border-radius: 12px; padding: 16px; margin-top: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals-row.total { border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 12px; font-weight: 700; font-size: 18px; color: #667eea; }
    .footer { background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    @media (max-width: 480px) { .content { padding: 20px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌾 Beeyond Harvest</h1>
      <p>${isNewOrder ? "New Order Confirmation" : "Order Status Update"}</p>
    </div>
    <div class="content">
      <h2 style="margin: 0 0 8px 0;">${isNewOrder ? "Hello " : "Hi "}${order.customer.name}!</h2>
      <p style="color: #6b7280; margin-bottom: 24px;">${message}</p>
      <div class="order-info">
        <h3>📋 Order Details</h3>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Order Number</div><div class="info-value">${order.orderNumber}</div></div>
          <div class="info-item"><div class="info-label">Order Date</div><div class="info-value">${new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
          <div class="info-item"><div class="info-label">Order Status</div><div class="info-value"><span class="status-badge">${order.orderStatus}</span></div></div>
          <div class="info-item"><div class="info-label">Payment Method</div><div class="info-value">${order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : order.paymentMethod}</div></div>
          <div class="info-item"><div class="info-label">Payment Status</div><div class="info-value">${order.paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}</div></div>
          ${order.trackingNumber ? `<div class="info-item"><div class="info-label">Tracking Number</div><div class="info-value">${order.trackingNumber}</div></div>` : ""}
        </div>
      </div>
      <h3 style="margin: 24px 0 12px 0;">🛍️ Order Items</h3>
      <table>
        <thead><tr><th>Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="totals">
        <div class="totals-row"><span>Subtotal:</span><span>${order.subtotal.toLocaleString()} ৳</span></div>
        <div class="totals-row"><span>Delivery Charge:</span><span>${order.deliveryCharge.toLocaleString()} ৳</span></div>
        <div class="totals-row total"><span>Total Amount:</span><span>${order.total.toLocaleString()} ৳</span></div>
      </div>
      <div style="text-align:center;">
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/orders/${order._id}" class="button">View Order Details</a>
      </div>
    </div>
    <div class="footer">
      <p>Beeyond Harvest - Fresh from farm to your doorstep 🌱</p>
      <p>Need help? Contact us at support@beeyondharvest.com</p>
      <p>© ${new Date().getFullYear()} Beeyond Harvest. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const generateAdminEmailTemplate = (order, type = "new_order") => {
  const title =
    type === "new_order" ? "🆕 New Order Received" : "🔄 Order Status Changed";
  const itemsList = order.items
    .map(
      (item) =>
        `• ${item.name} x ${item.quantity} = ${item.total.toLocaleString()} ৳`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: monospace; background: #f5f5f5; padding: 20px; }
    .admin-box { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; border-left: 4px solid #667eea; }
    .order-details { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="admin-box">
    <h2>${title}</h2>
    <p><strong>Order:</strong> ${order.orderNumber}</p>
    <p><strong>Customer:</strong> ${order.customer.name} (${order.customer.phone})</p>
    <p><strong>Email:</strong> ${order.customer.email}</p>
    <p><strong>Address:</strong> ${order.customer.address?.street || "N/A"}, ${order.customer.address?.area || ""}, ${order.customer.address?.city || ""}</p>
    <div class="order-details">
      <strong>Items:</strong><br/>
      ${itemsList.replace(/\n/g, "<br/>")}
      <hr/>
      <strong>Total:</strong> ${order.total.toLocaleString()} ৳<br/>
      <strong>Payment:</strong> ${order.paymentMethod}<br/>
      <strong>Status:</strong> ${order.orderStatus}
    </div>
    <p><a href="${process.env.ADMIN_URL || "http://localhost:5000"}/admin/orders/${order._id}" style="color:#667eea;">View in Admin Panel →</a></p>
  </div>
</body>
</html>`;
};

// ─── Helper: fire-and-forget email block ─────────────────────────────────────
const sendEmailsInBackground = (fn) => {
  if (process.env.DISABLE_EMAIL === "true") return;
  setImmediate(async () => {
    try {
      await fn();
    } catch (err) {
      console.error("📧 Background email error:", err.message);
    }
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Create order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    console.log("📦 Creating order:", JSON.stringify(req.body, null, 2));

    const { items, customer, paymentMethod, deliveryCharge } = req.body;

    if (!items || !items.length)
      return res
        .status(400)
        .json({ success: false, message: "No items in order" });

    if (!customer || !customer.name || !customer.email || !customer.phone)
      return res
        .status(400)
        .json({ success: false, message: "Customer information is required" });

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product)
        return res.status(404).json({
          success: false,
          message: `Product ${item.product} not found`,
        });
      if (product.stock < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });

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
    }

    const total = subtotal + (deliveryCharge || 60);
    const date = new Date();
    const count = await Order.countDocuments();
    const orderNumber = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(5, "0")}`;

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

    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    console.log("✅ Order created:", order.orderNumber);

    // ✅ Respond immediately
    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully.",
    });

    // 🔔 Emails in background — never blocks the response
    sendEmailsInBackground(async () => {
      const customerResult = await sendEmail(
        order.customer.email,
        `🎉 Order Confirmed - ${order.orderNumber}`,
        generateOrderEmailTemplate(order, "new_order"),
      );
      console.log(
        customerResult?.success
          ? `📧 Customer email sent to: ${order.customer.email}`
          : `⚠️ Customer email failed: ${customerResult?.error}`,
      );

      const adminEmails = (
        process.env.ADMIN_EMAILS || "ygstudiobd@gmail.com"
      ).split(",");
      const adminHtml = generateAdminEmailTemplate(order, "new_order");
      for (const email of adminEmails) {
        const r = await sendEmail(
          email.trim(),
          `🆕 New Order #${order.orderNumber} - Action Required`,
          adminHtml,
        );
        console.log(
          r?.success
            ? `📧 Admin email sent to: ${email.trim()}`
            : `⚠️ Admin email failed (${email.trim()}): ${r?.error}`,
        );
      }
    });
  } catch (error) {
    console.error("❌ Create order error:", error);
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

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("items.product", "name images")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const oldStatus = order.orderStatus;
    const newStatus = req.body.orderStatus;

    order.orderStatus = newStatus;
    if (req.body.trackingNumber) order.trackingNumber = req.body.trackingNumber;
    if (req.body.deliveryPartner)
      order.deliveryPartner = req.body.deliveryPartner;

    if (newStatus === "delivered" && order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.deliveryDate = new Date();
    }

    await order.save();

    // ✅ Respond immediately
    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${newStatus}${newStatus === "delivered" ? " & payment auto-completed" : ""}`,
    });

    // 🔔 Status update email in background
    if (oldStatus !== newStatus) {
      sendEmailsInBackground(async () => {
        const result = await sendEmail(
          order.customer.email,
          `📦 Order ${order.orderNumber} Status Updated to ${newStatus.toUpperCase()}`,
          generateOrderEmailTemplate(order, "status_update"),
        );
        console.log(
          result?.success
            ? `📧 Status email sent to: ${order.customer.email}`
            : `⚠️ Status email failed: ${result?.error}`,
        );
      });
    }
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update payment status
// @route   PUT /api/orders/:id/payment
// @access  Private
const updatePaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    order.paymentStatus = req.body.paymentStatus;
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send manual email
// @route   POST /api/orders/:id/send-email
// @access  Private
const sendManualOrderEmail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    if (process.env.DISABLE_EMAIL === "true")
      return res.json({ success: false, message: "Email is disabled" });

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
      res.json({ success: true, message: "Email sent successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || "Failed to send email",
      });
    }
  } catch (error) {
    console.error("Send manual email error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
const getOrderStats = async (req, res) => {
  try {
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
    console.error("Get order stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sales analytics
// @route   GET /api/orders/sales-analytics
// @access  Private
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const groupBy =
      period === "weekly" ? { $week: "$createdAt" } : { $month: "$createdAt" };

    const salesData = await Order.aggregate([
      { $match: { orderStatus: "delivered" } },
      {
        $group: { _id: groupBy, total: { $sum: "$total" }, count: { $sum: 1 } },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: salesData });
  } catch (error) {
    console.error("Sales analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  getSalesAnalytics,
  sendManualOrderEmail,
};
