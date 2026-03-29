const express = require("express");
const {
  getDashboardStats,
  getSalesAnalytics,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/stats",
  protect,
  authorize("admin", "super_admin"),
  getDashboardStats,
);
router.get(
  "/sales",
  protect,
  authorize("admin", "super_admin"),
  getSalesAnalytics,
);

module.exports = router;
