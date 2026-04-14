const mongoose = require("mongoose");

const trackerEventSchema = new mongoose.Schema(
  {
    // ── Session identity ──────────────────────────────────────
    sessionId: { type: String, required: true, index: true },
    visitorId: { type: String, index: true }, // persists across sessions (localStorage)

    // ── Device fingerprint ───────────────────────────────────
    device: {
      userAgent: String,
      language: String,
      platform: String,
      screenWidth: Number,
      screenHeight: Number,
      timezone: String,
      referrer: String,
      os: String, // parsed: "Android 13", "Windows 11", etc.
      browser: String, // parsed: "Chrome 124"
      deviceType: { type: String, enum: ["mobile", "tablet", "desktop"] },
      connectionType: String, // "4g", "wifi", etc. if available
    },

    // ── Network (from request headers) ───────────────────────
    ip: String,
    ipCountry: String, // filled later if you add geo lookup

    // ── Event payload ─────────────────────────────────────────
    events: [
      {
        type: {
          type: String,
          enum: [
            "page_view",
            "product_view",
            "product_detail_view",
            "add_to_cart",
            "remove_from_cart",
            "cart_open",
            "cart_checkout_open",
            "search",
            "category_filter",
            "sort_change",
            "coupon_apply_attempt",
            "coupon_apply_success",
            "coupon_apply_fail",
            "order_attempt",
            "order_success",
            "order_fail",
            "order_fraud_held",
            "track_order",
            "mobile_order_search",
            "chatbot_open",
            "chatbot_message",
            "scroll_depth",
            "rage_click",
            "idle",
            "policy_view",
            "nav_click",
            "modal_open",
            "modal_close",
            "custom",
          ],
        },
        ts: { type: Date, default: Date.now },
        payload: mongoose.Schema.Types.Mixed, // flexible per event type
      },
    ],

    // ── Session meta ──────────────────────────────────────────
    sessionStart: { type: Date, default: Date.now },
    sessionEnd: Date,
    pageCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now },

    // ── Linked data (set after order) ─────────────────────────
    linkedOrderNumber: String,
    linkedPhone: String,
  },
  {
    timestamps: true,
    // TTL: auto-delete after 90 days
    expireAfterSeconds: 60 * 60 * 24 * 90,
  },
);

// TTL index on createdAt
trackerEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
trackerEventSchema.index({ lastSeen: -1 });
trackerEventSchema.index({ "device.deviceType": 1 });
trackerEventSchema.index({ linkedOrderNumber: 1 });

module.exports = mongoose.model("TrackerSession", trackerEventSchema);
