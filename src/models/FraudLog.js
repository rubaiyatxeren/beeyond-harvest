const mongoose = require("mongoose");

const fraudLogSchema = new mongoose.Schema(
  {
    // Reference to the order being analyzed
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },

    // ── Risk Score & Verdict ─────────────────────────────────────────────────
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    verdict: {
      type: String,
      enum: ["safe", "review", "blocked"],
      required: true,
      index: true,
    },

    // ── Signal Breakdown ─────────────────────────────────────────────────────
    signals: {
      velocity: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
      orderPattern: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
      customerProfile: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
      addressRisk: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
      paymentBehavior: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
      deviceFingerprint: {
        score: { type: Number, default: 0 },
        flags: [String],
        data: mongoose.Schema.Types.Mixed,
      },
    },

    // ── All Human-readable flags ─────────────────────────────────────────────
    allFlags: [String],

    // ── Admin action ─────────────────────────────────────────────────────────
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
    reviewAction: {
      type: String,
      enum: ["approved", "rejected", "escalated", null],
      default: null,
    },
    reviewNote: String,

    // ── Auto-action taken ────────────────────────────────────────────────────
    autoAction: {
      type: String,
      enum: ["none", "flagged", "cancelled", "held"],
      default: "none",
    },

    // ── Request metadata ────────────────────────────────────────────────────
    ipAddress: String,
    userAgent: String,
    fingerprint: String, // hash of device signals
  },
  {
    timestamps: true,
  },
);

// Indexes for fast querying
fraudLogSchema.index({ riskScore: -1, createdAt: -1 });
fraudLogSchema.index({ verdict: 1, reviewAction: 1 });
fraudLogSchema.index({ order: 1 }, { unique: true });

module.exports = mongoose.model("FraudLog", fraudLogSchema);
