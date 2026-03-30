// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order"); // ← ADD THIS
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
