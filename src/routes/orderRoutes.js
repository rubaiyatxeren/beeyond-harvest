// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  getSalesAnalytics,
  sendManualOrderEmail,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/", createOrder);

// Private routes (admin only)
router.get("/", protect, getOrders);
router.get("/stats", protect, getOrderStats);
router.get("/sales-analytics", protect, getSalesAnalytics);
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, updateOrderStatus);
router.put("/:id/payment", protect, updatePaymentStatus);
router.post("/:id/send-email", protect, sendManualOrderEmail);

module.exports = router;
