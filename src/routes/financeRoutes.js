// routes/financeRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  // Transactions
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  voidTransaction,
  bulkCreateTransactions,
  // Summary & Analytics
  getFinanceSummary,
  getPnLStatement,
  getCategoryAnalytics,
  getCashFlowProjection,
  // Budgets
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
  // Import
  importOrderIncome,
  // Utility
  getCategories,
  exportTransactions,
  getBalance,
} = require("../controllers/financeController");

// All finance routes require authentication
router.use(protect);

// ── Dashboard & Summary ────────────────────────────────────────────────────────
// GET /api/finance/summary?period=month|week|today|year|all
router.get("/summary", getFinanceSummary);

// GET /api/finance/balance
router.get("/balance", getBalance);

// ── Analytics ─────────────────────────────────────────────────────────────────
// GET /api/finance/pnl?months=12
router.get("/pnl", getPnLStatement);

// GET /api/finance/analytics/categories?type=expense&period=month
router.get("/analytics/categories", getCategoryAnalytics);

// GET /api/finance/cashflow?days=30
router.get("/cashflow", getCashFlowProjection);

// ── Categories (dynamic) ──────────────────────────────────────────────────────
// GET /api/finance/categories?type=expense
router.get("/categories", getCategories);

// ── Export ────────────────────────────────────────────────────────────────────
// GET /api/finance/export?period=month&type=expense
router.get("/export", exportTransactions);

// ── Import from Orders ────────────────────────────────────────────────────────
// POST /api/finance/import/orders
router.post("/import/orders", importOrderIncome);

// ── Transactions ──────────────────────────────────────────────────────────────
// GET  /api/finance/transactions
// POST /api/finance/transactions
router.route("/transactions").get(getTransactions).post(createTransaction);

// POST /api/finance/transactions/bulk
router.post("/transactions/bulk", bulkCreateTransactions);

// GET    /api/finance/transactions/:id
// PUT    /api/finance/transactions/:id
// DELETE /api/finance/transactions/:id  (soft-void)
router
  .route("/transactions/:id")
  .get(getTransaction)
  .put(updateTransaction)
  .delete(voidTransaction);

// ── Budgets ───────────────────────────────────────────────────────────────────
// GET  /api/finance/budgets
// POST /api/finance/budgets
router.route("/budgets").get(getBudgets).post(createBudget);

// PUT    /api/finance/budgets/:id
// DELETE /api/finance/budgets/:id
router.route("/budgets/:id").put(updateBudget).delete(deleteBudget);

module.exports = router;
