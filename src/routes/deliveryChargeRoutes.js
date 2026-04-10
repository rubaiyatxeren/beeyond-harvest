const express = require("express");
const router = express.Router();
const {
  getDeliveryCharges,
  getActiveDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  updateSingleDeliveryCharge,
} = require("../controllers/deliveryChargeController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Public routes (no authentication required)
router.get("/", getDeliveryCharges);
router.get("/active", getActiveDeliveryCharge);

// Admin only routes
router.post("/", protect, updateDeliveryCharge);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "admin"),
  updateSingleDeliveryCharge,
);
router.delete("/:id", protect, deleteDeliveryCharge);

module.exports = router;
