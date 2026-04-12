// routes/profitRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  syncOrderProfit,
  syncAllProfit,
  getProfitSummary,
  getDailyProfit,
  getMonthlyProfit,
  getProductProfitBreakdown,
  getOrderProfit,
  updateProductCosts,
  getAllProductCosts,
} = require("../controllers/profitController");

// All profit routes are admin-only
router.use(protect);

// ── Summary & Analytics ────────────────────────────────────────────────────────
router.get("/summary", getProfitSummary);
router.get("/daily", getDailyProfit);
router.get("/monthly", getMonthlyProfit);

// ── Product-level breakdown ────────────────────────────────────────────────────
// NOTE: /products/costs MUST come BEFORE /products/:productId/costs
// Otherwise Express matches "costs" as the :productId param → wrong handler + CORS fails
router.get("/products/costs", getAllProductCosts);              // ← static route first
router.get("/products", getProductProfitBreakdown);
router.patch("/products/:productId/costs", updateProductCosts); // ← parameterised after

// ── Per-order ─────────────────────────────────────────────────────────────────
router.get("/order/:orderId", getOrderProfit);

// ── Sync ──────────────────────────────────────────────────────────────────────
router.post("/sync/:orderId", syncOrderProfit);
router.post("/sync-all", syncAllProfit);

module.exports = router;
