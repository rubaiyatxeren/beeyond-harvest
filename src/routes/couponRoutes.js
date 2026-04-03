const express = require("express");
const router = express.Router();
const {
  getCoupons,
  getCoupon,
  validateCoupon,
  applyCoupon,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  getCouponStats,
} = require("../controllers/couponController");

const { protect, authorize } = require("../middleware/authMiddleware");

// ─── Public Routes (used by customer checkout) ────────────────────────────────

// POST /api/coupons/validate  — check code + get discount amount (no DB write)
router.post("/validate", validateCoupon);

// POST /api/coupons/apply     — check code + increment usedCount (call after order created)
router.post("/apply", applyCoupon);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/coupons/stats      — must come BEFORE /:id to avoid "stats" being treated as an id
router.get("/stats", protect, getCouponStats);

// GET    /api/coupons         — list all (with optional ?isActive=true&search=CODE&page=1&limit=20)
// POST   /api/coupons         — create new coupon
router.route("/").get(protect, getCoupons).post(protect, createCoupon);

// GET    /api/coupons/:id     — get single coupon
// PUT    /api/coupons/:id     — full update
// DELETE /api/coupons/:id     — delete
router
  .route("/:id")
  .get(protect, getCoupon)
  .put(protect, updateCoupon)
  .delete(protect, deleteCoupon);

// PATCH  /api/coupons/:id/toggle  — flip isActive
router.patch("/:id/toggle", protect, toggleCoupon);

module.exports = router;
