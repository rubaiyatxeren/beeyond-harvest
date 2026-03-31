const DeliveryCharge = require("../models/DeliveryCharge");

// Get all delivery charges
exports.getDeliveryCharges = async (req, res) => {
  try {
    const charges = await DeliveryCharge.find().sort({ minOrderAmount: 1 });
    res.json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get active delivery charge (for customers)
exports.getActiveDeliveryCharge = async (req, res) => {
  try {
    const { city, subtotal } = req.query;

    let charge = await DeliveryCharge.findOne({
      isActive: true,
      minOrderAmount: { $lte: subtotal || 0 },
    }).sort({ minOrderAmount: -1 });

    // If no matching charge, get default
    if (!charge) {
      charge = await DeliveryCharge.findOne({
        isActive: true,
        name: "default",
      });
    }

    // If still no charge, return default 60
    if (!charge) {
      return res.json({
        success: true,
        data: { amount: 60, name: "default" },
      });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or update delivery charge (Admin only)
exports.updateDeliveryCharge = async (req, res) => {
  try {
    const { name, amount, minOrderAmount, isActive } = req.body;

    let charge = await DeliveryCharge.findOne({ name });

    if (charge) {
      // Update existing
      charge.amount = amount;
      charge.minOrderAmount = minOrderAmount || 0;
      charge.isActive = isActive !== undefined ? isActive : charge.isActive;
      charge.updatedAt = Date.now();
      await charge.save();
    } else {
      // Create new
      charge = await DeliveryCharge.create({
        name,
        amount,
        minOrderAmount: minOrderAmount || 0,
        isActive: isActive !== undefined ? isActive : true,
      });
    }

    res.json({ success: true, data: charge });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete delivery charge (Admin only)
exports.deleteDeliveryCharge = async (req, res) => {
  try {
    const { id } = req.params;
    await DeliveryCharge.findByIdAndDelete(id);
    res.json({ success: true, message: "Delivery charge deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
