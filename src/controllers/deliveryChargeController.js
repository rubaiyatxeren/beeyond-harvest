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

// Get active delivery charge (for customers)
exports.getActiveDeliveryCharge = async (req, res) => {
  console.log("📦 GET /api/delivery-charges/active called", req.query);
  try {
    const { city, subtotal } = req.query;
    const orderAmount = parseFloat(subtotal) || 0;

    // Get all active delivery charges
    const allCharges = await DeliveryCharge.find({ isActive: true });
    console.log(`Found ${allCharges.length} active charges`);

    // Log all charges for debugging
    console.log("Available charges:");
    allCharges.forEach((charge) => {
      console.log(`  - ${charge.name}: ৳${charge.amount} (ID: ${charge._id})`);
    });

    let selectedCharge = null;

    // ✅ CORRECT LOGIC: Only use inside_dhaka for Dhaka city
    if (city && city.toLowerCase() === "dhaka") {
      // Inside Dhaka - use inside_dhaka charge
      selectedCharge = allCharges.find((c) => c.name === "inside_dhaka");
      console.log(`📍 Inside Dhaka detected, looking for inside_dhaka charge`);
    } else if (city) {
      // Outside Dhaka - use outside_dhaka charge
      selectedCharge = allCharges.find((c) => c.name === "outside_dhaka");
      console.log(
        `📍 Outside Dhaka detected (${city}), looking for outside_dhaka charge`,
      );
    }

    // If no specific charge found, use default
    if (!selectedCharge) {
      selectedCharge = allCharges.find((c) => c.name === "default");
      console.log("⚠️ Using default charge");
    }

    // If still no charge, use fallback
    if (!selectedCharge) {
      console.log("⚠️ No charges found, using fallback 60");
      return res.json({
        success: true,
        data: { amount: 60, name: "fallback" },
      });
    }

    console.log(
      `✅ Selected charge: ${selectedCharge.name} - ৳${selectedCharge.amount}`,
    );
    res.json({
      success: true,
      data: {
        amount: selectedCharge.amount,
        name: selectedCharge.name,
        minOrderAmount: selectedCharge.minOrderAmount,
      },
    });
  } catch (error) {
    console.error("Error in getActiveDeliveryCharge:", error);
    res.status(500).json({ success: false, message: error.message });
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
