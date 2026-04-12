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
// GET /api/profit/summary?period=month|week|today|year|all
router.get("/summary", getProfitSummary);

// GET /api/profit/daily?days=30
router.get("/daily", getDailyProfit);

// GET /api/profit/monthly?months=12
router.get("/monthly", getMonthlyProfit);

// ── Product-level breakdown ────────────────────────────────────────────────────
// GET /api/profit/products?period=month&page=1&limit=20
router.get("/products", getProductProfitBreakdown);

// GET /api/profit/products/costs  — all products with cost fields (for management UI)
router.get("/products/costs", getAllProductCosts);

// PATCH /api/profit/products/:productId/costs  — update cost info for a product
router.patch("/products/:productId/costs", updateProductCosts);

// ── Per-order ─────────────────────────────────────────────────────────────────
// GET /api/profit/order/:orderId
router.get("/order/:orderId", getOrderProfit);

// ── Sync ──────────────────────────────────────────────────────────────────────
// POST /api/profit/sync/:orderId  — sync single order snapshot
router.post("/sync/:orderId", syncOrderProfit);

// POST /api/profit/sync-all  — bulk sync all orders without snapshots
router.post("/sync-all", syncAllProfit);

module.exports = router;
