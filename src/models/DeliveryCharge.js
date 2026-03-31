const mongoose = require("mongoose");

const deliveryChargeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["inside_dhaka", "outside_dhaka", "default"],
    default: "default",
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    description:
      "Minimum order amount for this delivery charge (0 = always applicable)",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DeliveryCharge", deliveryChargeSchema);
