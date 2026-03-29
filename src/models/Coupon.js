const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    minimumOrder: {
      type: Number,
      default: 0,
      min: [0, "Minimum order cannot be negative"],
    },
    maximumDiscount: {
      type: Number,
      min: [0, "Maximum discount cannot be negative"],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    usageLimit: {
      type: Number,
      min: [0, "Usage limit cannot be negative"],
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Coupon", couponSchema);
