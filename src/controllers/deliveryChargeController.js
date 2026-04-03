const DeliveryCharge = require("../models/DeliveryCharge");

// Log that the controller loaded
console.log("✅ DeliveryChargeController loaded");

// Get all delivery charges
exports.getDeliveryCharges = async (req, res) => {
  console.log("📦 GET /api/delivery-charges called");
  try {
    const charges = await DeliveryCharge.find().sort({ minOrderAmount: 1 });
    console.log(`Found ${charges.length} delivery charges`);
    res.json({ success: true, data: charges });
  } catch (error) {
    console.error("Error in getDeliveryCharges:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add at the top of deliveryChargeController.js
let cachedCharges = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minute cache

// Modify getActiveDeliveryCharge function
exports.getActiveDeliveryCharge = async (req, res) => {
  console.log("📦 GET /api/delivery-charges/active called", req.query);

  try {
    const { city, subtotal } = req.query;
    const orderAmount = parseFloat(subtotal) || 0;

    // Use cache for charges (reduces DB calls)
    let allCharges;
    if (cachedCharges && Date.now() - cacheTimestamp < CACHE_TTL) {
      allCharges = cachedCharges;
      console.log("📦 Using cached delivery charges");
    } else {
      allCharges = await DeliveryCharge.find({ isActive: true });
      cachedCharges = allCharges;
      cacheTimestamp = Date.now();
      console.log(`📦 Fetched ${allCharges.length} delivery charges from DB`);
    }

    // Quick response - no heavy processing
    let finalAmount = 60; // default fallback
    let selectedCharge = { name: "fallback", amount: 60 };

    // Check for special default charge (min 999)
    const defaultCharge = allCharges.find((c) => c.name === "default");

    if (defaultCharge && orderAmount >= (defaultCharge.minOrderAmount || 999)) {
      finalAmount = defaultCharge.amount;
      selectedCharge = defaultCharge;
    } else if (city?.toLowerCase() === "dhaka") {
      const dhakaCharge = allCharges.find((c) => c.name === "inside_dhaka");
      if (dhakaCharge) {
        finalAmount = dhakaCharge.amount;
        selectedCharge = dhakaCharge;
      }
    } else if (city) {
      const outsideCharge = allCharges.find((c) => c.name === "outside_dhaka");
      if (outsideCharge) {
        finalAmount = outsideCharge.amount;
        selectedCharge = outsideCharge;
      }
    }

    console.log(`🎯 Final charge: ${selectedCharge.name} - ৳${finalAmount}`);

    // Send response quickly
    res.json({
      success: true,
      data: {
        amount: finalAmount,
        name: selectedCharge.name,
        minOrderAmount: selectedCharge.minOrderAmount || 0,
      },
    });
  } catch (error) {
    console.error("Error in getActiveDeliveryCharge:", error);
    // Always return a valid response, even on error
    res.json({
      success: true,
      data: { amount: 60, name: "fallback", minOrderAmount: 0 },
    });
  }
};
// Create or update delivery charge (Admin only)
exports.updateDeliveryCharge = async (req, res) => {
  console.log("📦 POST /api/delivery-charges called");
  console.log("Request body:", req.body);
  console.log("User:", req.user ? req.user._id : "No user");

  try {
    const { name, amount, minOrderAmount, isActive } = req.body;

    if (!name || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name and amount",
      });
    }

    console.log(`Processing delivery charge: ${name}, amount: ${amount}`);

    let charge = await DeliveryCharge.findOne({ name });

    if (charge) {
      console.log(`Updating existing charge: ${charge._id}`);
      charge.amount = amount;
      charge.minOrderAmount = minOrderAmount || 0;
      charge.isActive = isActive !== undefined ? isActive : charge.isActive;
      charge.updatedAt = Date.now();
      await charge.save();
      console.log("✅ Charge updated successfully");
    } else {
      console.log("Creating new charge");
      charge = await DeliveryCharge.create({
        name,
        amount,
        minOrderAmount: minOrderAmount || 0,
        isActive: isActive !== undefined ? isActive : true,
      });
      console.log("✅ Charge created successfully");
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    console.error("❌ Error in updateDeliveryCharge:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete delivery charge (Admin only)
exports.deleteDeliveryCharge = async (req, res) => {
  console.log("📦 DELETE /api/delivery-charges/:id called", req.params.id);
  try {
    const { id } = req.params;
    await DeliveryCharge.findByIdAndDelete(id);
    console.log("✅ Charge deleted");
    res.json({ success: true, message: "Delivery charge deleted" });
  } catch (error) {
    console.error("Error in deleteDeliveryCharge:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
