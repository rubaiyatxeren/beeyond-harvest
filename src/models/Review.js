const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // ── Core references ───────────────────────────────────────
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    orderNumber: { type: String, required: true },

    // ── Customer info (copied from order, no auth needed) ─────
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true },
    customerPhone: { type: String },

    // ── Review content ────────────────────────────────────────
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 2000 },

    // ── Token tracking (one-time use) ─────────────────────────
    reviewToken: { type: String, index: true }, // hashed token stored here
    tokenUsed: { type: Boolean, default: false },

    // ── Moderation ────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
    moderationNote: String,

    // ── Helpful votes ─────────────────────────────────────────
    helpfulVotes: { type: Number, default: 0 },
    notHelpfulVotes: { type: Number, default: 0 },
    voterEmails: [String], // prevent duplicate votes (no auth, use email from token)

    // ── Verified purchase (always true via this flow) ─────────
    isVerifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Compound index: one review per product per order
reviewSchema.index({ order: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1 });

module.exports = mongoose.model("Review", reviewSchema);
