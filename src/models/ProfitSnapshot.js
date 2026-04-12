const mongoose = require("mongoose");

/**
 * ProfitSnapshot — stores per-order profit data at the time of delivery.
 * Decoupled from Order so historical profit is never affected by product cost changes.
 */
const profitSnapshotSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true, // one snapshot per order
    },
    orderNumber: {
      type: String,
      required: true,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },

    // ── Revenue ──────────────────────────────────────
    subtotal: { type: Number, required: true },
    deliveryRevenue: { type: Number, default: 0 }, // what customer paid for delivery
    discount: { type: Number, default: 0 },
    totalRevenue: { type: Number, required: true }, // order.total

    // ── Costs ────────────────────────────────────────
    productCost: { type: Number, default: 0 }, // sum of (costPerUnit * qty) for each item
    packagingCost: { type: Number, default: 0 }, // sum of (packagingCost * qty) for each item
    deliveryCost: { type: Number, default: 0 }, // actual cost to deliver (from order deliveryCharge or manual)

    totalCost: { type: Number, default: 0 }, // productCost + packagingCost + deliveryCost

    // ── Profit ───────────────────────────────────────
    grossProfit: { type: Number, default: 0 }, // totalRevenue - totalCost
    profitMargin: { type: Number, default: 0 }, // grossProfit / totalRevenue * 100

    // ── Item breakdown (for per-product analytics) ──
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        sku: String,
        quantity: Number,
        sellingPrice: Number,
        costPerUnit: Number,
        packagingCostPerUnit: Number,
        itemRevenue: Number,
        itemCost: Number,
        itemProfit: Number,
      },
    ],

    // ── Status ───────────────────────────────────────
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    isRealized: {
      type: Boolean,
      default: false, // true only when delivered (payment confirmed)
    },
  },
  { timestamps: true },
);

// Indexes for fast analytics queries
profitSnapshotSchema.index({ orderDate: -1 });
profitSnapshotSchema.index({ isRealized: 1, orderDate: -1 });
profitSnapshotSchema.index({ "items.product": 1 });

module.exports = mongoose.model("ProfitSnapshot", profitSnapshotSchema);
