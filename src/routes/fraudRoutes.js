const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  analyzeOrderById,
  bulkScan,
  getFraudLogs,
  getFraudLog,
  reviewFraudLog,
  getFraudStats,
  getCustomerRisk,
} = require("../controllers/fraudController");

// All fraud routes are admin-only
router.use(protect);

// Dashboard
router.get("/stats", getFraudStats);

// Logs
router.get("/logs", getFraudLogs);
router.get("/logs/:id", getFraudLog);
router.put("/logs/:id/review", reviewFraudLog);

// Analysis
router.post("/analyze/:orderId", analyzeOrderById);
router.post("/bulk-scan", bulkScan);

// Customer risk profile
router.get("/customer-risk", getCustomerRisk);

module.exports = router;
