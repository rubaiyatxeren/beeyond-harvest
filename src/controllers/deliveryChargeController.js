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
      console.log(
        `  - ${charge.name}: ৳${charge.amount} (min: ${charge.minOrderAmount})`,
      );
    });

    let selectedCharge = null;
    let finalAmount = null;

    // ✅ STEP 1: Check if city is Dhaka
    if (city && city.toLowerCase() === "dhaka") {
      selectedCharge = allCharges.find((c) => c.name === "inside_dhaka");
      console.log(`📍 Dhaka city detected - looking for inside_dhaka`);
    }
    // ✅ STEP 2: For any other city with name, use outside_dhaka
    else if (city && city.trim()) {
      selectedCharge = allCharges.find((c) => c.name === "outside_dhaka");
      console.log(
        `📍 Non-Dhaka city (${city}) detected - looking for outside_dhaka`,
      );
    }

    // ✅ STEP 3: Check min order amount if applicable
    if (selectedCharge) {
      finalAmount = selectedCharge.amount;

      // Check min order amount for this charge
      if (
        selectedCharge.minOrderAmount > 0 &&
        orderAmount < selectedCharge.minOrderAmount
      ) {
        // If order amount is less than min, look for another charge
        console.log(
          `⚠️ Order amount ${orderAmount} is less than min ${selectedCharge.minOrderAmount}`,
        );

        // Try to find a charge without min amount or with lower min
        const fallbackCharge = allCharges.find(
          (c) =>
            c.name !== selectedCharge.name &&
            (c.minOrderAmount === 0 || orderAmount >= c.minOrderAmount),
        );

        if (fallbackCharge) {
          finalAmount = fallbackCharge.amount;
          console.log(
            `📌 Using fallback charge: ${fallbackCharge.name} - ৳${finalAmount}`,
          );
        } else {
          // Use default charge
          const defaultCharge = allCharges.find((c) => c.name === "default");
          if (
            defaultCharge &&
            (defaultCharge.minOrderAmount === 0 ||
              orderAmount >= defaultCharge.minOrderAmount)
          ) {
            finalAmount = defaultCharge.amount;
            console.log(`📌 Using default charge: ৳${finalAmount}`);
          }
        }
      }
    }

    // ✅ STEP 4: If still no charge selected, try default
    if (!selectedCharge && !finalAmount) {
      const defaultCharge = allCharges.find((c) => c.name === "default");
      if (
        defaultCharge &&
        (defaultCharge.minOrderAmount === 0 ||
          orderAmount >= defaultCharge.minOrderAmount)
      ) {
        finalAmount = defaultCharge.amount;
        selectedCharge = defaultCharge;
        console.log(`📌 Using default charge: ৳${finalAmount}`);
      }
    }

    // ✅ STEP 5: Final fallback
    if (!finalAmount) {
      console.log("⚠️ No valid charges found, using fallback 60");
      return res.json({
        success: true,
        data: { amount: 60, name: "fallback" },
      });
    }

    console.log(
      `✅ Returning: ${selectedCharge?.name || "fallback"} - ৳${finalAmount}`,
    );
    res.json({
      success: true,
      data: {
        amount: finalAmount,
        name: selectedCharge?.name || "fallback",
        minOrderAmount: selectedCharge?.minOrderAmount || 0,
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
