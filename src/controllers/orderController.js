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
    // ✅ FIX 1: ORDER NUMBER — no race condition
    // ==============================
    const date = new Date();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    const orderNumber = `ORD-${date.getFullYear()}${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}-${timestamp}`;

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
    // ✅ FIX 2: ATOMIC STOCK UPDATE — prevents overselling
    // ==============================
    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.product, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity } },
      },
    }));

    const stockResult = await Product.bulkWrite(bulkOps);

    if (stockResult.modifiedCount !== items.length) {
      // Roll back order if stock was insufficient
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
    // 🔔 BACKGROUND EMAIL (NON-BLOCKING)
    // ==============================
    if (process.env.DISABLE_EMAIL === "true") return;

    setImmediate(async () => {
      try {
        console.log(`📧 Sending emails for ${order.orderNumber}`);

        // Customer email
        await sendEmail(
          order.customer.email,
          `🎉 Order Confirmed - ${order.orderNumber}`,
          generateOrderEmailTemplate(order, "new_order"),
        ).catch((err) =>
          console.error("❌ Customer email failed:", err.message),
        );

        // Admin emails
        const adminEmails = (
          process.env.ADMIN_EMAILS || "ygstudiobd@gmail.com"
        ).split(",");

        const adminHtml = generateAdminEmailTemplate(order, "new_order");

        adminEmails.map((email) =>
          sendEmail(
            email.trim(),
            `🆕 New Order #${order.orderNumber}`,
            adminHtml,
          ).catch((err) =>
            console.error(`❌ Admin email failed (${email}):`, err.message),
          ),
        );

        console.log(`✅ Emails sent for ${order.orderNumber}`);
      } catch (err) {
        console.error("❌ Email error:", err.message);
      }
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
