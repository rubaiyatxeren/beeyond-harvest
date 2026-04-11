const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  analyzeOrderById,
  bulkScan,
  getFraudLogs,
  getFraudLog,
  reviewFraudLog,
  getFraudStats,
  getCustomerRisk,
} = require("../controllers/fraudController");

// ─── All fraud routes require authentication ──────────────────────────────────
router.use(protect);

// ─── Role restriction: only super_admin and admin ─────────────────────────────
// managers cannot access fraud detection at all
const fraudAccess = authorize("super_admin", "admin");

// Dashboard stats
router.get("/stats", fraudAccess, getFraudStats);

// Fraud logs — read-only, both admin roles
router.get("/logs", fraudAccess, getFraudLogs);
router.get("/logs/:id", fraudAccess, getFraudLog);

// Review action — only super_admin can approve/reject/escalate
router.put("/logs/:id/review", authorize("super_admin"), reviewFraudLog);

// Analysis — only super_admin can trigger manual scans
router.post("/analyze/:orderId", authorize("super_admin"), analyzeOrderById);

// Bulk scan — super_admin only (expensive operation)
router.post("/bulk-scan", authorize("super_admin"), bulkScan);

// Customer risk lookup — both admin roles
router.get("/customer-risk", fraudAccess, getCustomerRisk);

module.exports = router;
