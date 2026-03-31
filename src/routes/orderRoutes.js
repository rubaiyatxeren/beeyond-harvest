// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order"); // ← ADD THIS
const Product = require("../models/Product");
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  getSalesAnalytics,
  sendManualOrderEmail,
  getOrdersByPhone,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/", createOrder);

router.get("/track/:orderNumber", async (req, res) => {
  try {
    const orderNumber = decodeURIComponent(req.params.orderNumber)
      .trim()
      .toUpperCase();
    console.log("SEARCHING FOR:", orderNumber);

    // Try exact match first
    let order = await Order.findOne({ orderNumber: orderNumber }).populate(
      "items.product",
      "name images",
    );

    // Fallback: case-insensitive regex
    if (!order) {
      order = await Order.findOne({
        orderNumber: { $regex: new RegExp(`^${orderNumber}$`, "i") },
      }).populate("items.product", "name images");
    }

    // Fallback: search by _id if it looks like a MongoDB ObjectId
    if (!order && orderNumber.length === 24) {
      order = await Order.findById(orderNumber).populate(
        "items.product",
        "name images",
      );
    }

    console.log("FOUND:", order ? order.orderNumber : "NOTHING");

    if (!order) {
      // List recent orders to debug
      const recent = await Order.find({})
        .sort("-createdAt")
        .limit(3)
        .select("orderNumber");
      console.log(
        "RECENT ORDERS:",
        recent.map((o) => o.orderNumber),
      );

      return res.status(404).json({
        success: false,
        message: "Order not found",
        searchedFor: orderNumber,
        recentOrders: recent.map((o) => o.orderNumber), // remove after debugging
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("TRACK ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// ─── LOAD TEST ROUTE (remove in production) ───────────────────────────────────
// POST /api/orders/load-test
router.post("/load-test", async (req, res) => {
  const { count = 10, sendEmails = false } = req.body;

  if (count > 1000) {
    return res
      .status(400)
      .json({ success: false, message: "Max 1000 orders per test" });
  }

  const startTime = Date.now();
  const results = { created: 0, failed: 0, errors: [] };

  // ── Fake product pool (uses your real products from DB) ──────────────────────
  const products = await Product.find({ stock: { $gt: 10 } })
    .limit(10)
    .lean();
  if (!products.length) {
    return res.status(400).json({
      success: false,
      message: "No products with stock > 10 found. Add products first.",
    });
  }

  // ── Bangladeshi fake data pools ───────────────────────────────────────────────
  const firstNames = [
    "Rahim",
    "Karim",
    "Jamal",
    "Sohel",
    "Rafi",
    "Nadia",
    "Mitu",
    "Puja",
    "Tania",
    "Riya",
  ];
  const lastNames = [
    "Hossain",
    "Islam",
    "Ahmed",
    "Khan",
    "Begum",
    "Akter",
    "Mia",
    "Chowdhury",
    "Paul",
    "Das",
  ];
  const areas = [
    "Mirpur",
    "Dhanmondi",
    "Gulshan",
    "Uttara",
    "Mohammadpur",
    "Banani",
    "Motijheel",
    "Wari",
  ];
  const cities = ["Dhaka", "Chittagong", "Sylhet", "Rajshahi", "Khulna"];
  const methods = ["cash_on_delivery", "bkash", "nagad"];

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  const randPhone = () =>
    `01${randInt(3, 9)}${String(randInt(10000000, 99999999))}`;

  // ── Generate orders in batches of 50 to avoid overwhelming DB ────────────────
  const BATCH_SIZE = 50;
  const orders = [];

  // Get base timestamp for unique order numbers
  const timestampBase = Date.now();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  for (let i = 0; i < count; i++) {
    const firstName = rand(firstNames);
    const lastName = rand(lastNames);
    const name = `${firstName} ${lastName}`;
    const email = `test.${firstName.toLowerCase()}${randInt(1, 999)}@loadtest.com`;
    const phone = randPhone();

    // Pick 1-3 random products
    const itemCount = randInt(1, Math.min(3, products.length));
    const shuffled = [...products]
      .sort(() => Math.random() - 0.5)
      .slice(0, itemCount);
    const items = shuffled.map((p) => ({
      product: p._id,
      name: p.name,
      sku: p.sku || "N/A",
      quantity: randInt(1, 3),
      price: p.price,
      total: p.price * randInt(1, 3),
    }));

    // Recalculate totals properly
    items.forEach((item) => {
      item.total = item.price * item.quantity;
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const deliveryCharge = rand([0, 60, 80, 100]);
    const total = subtotal + deliveryCharge;

    // Generate unique order number for load test
    const orderNumber = `LT-${year}${month}-${String(i + 1).padStart(5, "0")}`;

    orders.push({
      orderNumber, // Add the unique order number
      customer: {
        name,
        email,
        phone,
        address: {
          street: `${randInt(1, 99)} ${rand(areas)} Road`,
          area: rand(areas),
          city: rand(cities),
          district: rand(cities),
          division: rand(cities),
        },
      },
      items,
      subtotal,
      deliveryCharge,
      total,
      paymentMethod: rand(methods),
      paymentStatus: "pending",
      orderStatus: rand(["pending", "confirmed", "processing"]),
    });
  }

  // ── Insert in batches ─────────────────────────────────────────────────────────
  for (let b = 0; b < orders.length; b += BATCH_SIZE) {
    const batch = orders.slice(b, b + BATCH_SIZE);
    try {
      await Order.insertMany(batch, {
        ordered: false, // don't stop on error
        bypassDocumentValidation: true, // Skip validation if needed
      });
      results.created += batch.length;
    } catch (err) {
      // insertMany with ordered:false reports partial success
      const inserted = err.result?.nInserted || 0;
      results.created += inserted;
      results.failed += batch.length - inserted;

      // Log detailed error information
      if (err.writeErrors) {
        err.writeErrors.forEach((error) => {
          results.errors.push(
            `Order ${error.err.op.orderNumber}: ${error.err.errmsg}`,
          );
        });
      } else {
        results.errors.push(err.message.slice(0, 200));
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    `🧪 [LOAD TEST] ${results.created}/${count} orders created in ${elapsed}s`,
  );

  if (results.failed > 0) {
    console.log(`❌ Failed orders: ${results.failed}`);
    console.log(`📋 Errors:`, results.errors);
  }

  res.json({
    success: true,
    summary: {
      requested: count,
      created: results.created,
      failed: results.failed,
      duration: `${elapsed}s`,
      rate:
        results.created > 0
          ? `${(results.created / elapsed).toFixed(0)} orders/sec`
          : "0 orders/sec",
      emailsSent: sendEmails,
    },
    errors: results.errors.length ? results.errors : undefined,
    tip: "Refresh your admin orders panel to see the test orders. Filter by 'load test' emails to clean up.",
  });
});

// DELETE /api/orders/load-test/cleanup — remove all load test orders
router.delete("/load-test/cleanup", protect, async (req, res) => {
  try {
    const result = await Order.deleteMany({
      "customer.email": { $regex: /@loadtest\.com$/i },
    });
    console.log(`🧹 [CLEANUP] Deleted ${result.deletedCount} test orders`);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Private routes (admin only)
router.get("/", protect, getOrders);
router.get("/stats", protect, getOrderStats);
router.get("/sales-analytics", protect, getSalesAnalytics);
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, updateOrderStatus);
router.put("/:id/payment", protect, updatePaymentStatus);
router.post("/:id/send-email", protect, sendManualOrderEmail);

router.get("/phone/:phone", getOrdersByPhone);

module.exports = router;
