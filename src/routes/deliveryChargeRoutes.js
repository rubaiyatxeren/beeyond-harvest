const express = require("express");
const router = express.Router();
const {
  getDeliveryCharges,
  getActiveDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
} = require("../controllers/deliveryChargeController");
const { protect } = require("../middleware/authMiddleware");

// Public routes (no authentication required)
router.get("/", getDeliveryCharges);
router.get("/active", getActiveDeliveryCharge);

// Admin only routes
router.post("/", protect, updateDeliveryCharge);
router.delete("/:id", protect, deleteDeliveryCharge);

module.exports = router;
