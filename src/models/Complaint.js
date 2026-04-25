const mongoose = require("mongoose");

// ── Reply sub-schema ────────────────────────────────────────────────────────
const replySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Reply cannot exceed 2000 characters"],
    },
    authorType: {
      type: String,
      enum: ["admin", "customer"],
      required: true,
    },
    authorName: {
      type: String,
      default: "Admin",
    },
    isInternal: {
      // Admin-only notes — never sent to customer
      type: Boolean,
      default: false,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// ── Status History sub-schema ────────────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    changedBy: { type: String, default: "admin" },
    reason: String,
  },
  { timestamps: true },
);

// ── Main Complaint schema ────────────────────────────────────────────────────
const complaintSchema = new mongoose.Schema(
  {
    // ── Identifier ──────────────────────────────────────────────────────────
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // ── Customer info ────────────────────────────────────────────────────────
    customer: {
      name: {
        type: String,
        required: [true, "Customer name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
      },
      email: {
        type: String,
        required: [true, "Customer email is required"],
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      },
      phone: {
        type: String,
        trim: true,
        match: [
          /^01[3-9]\d{8}$/,
          "Please provide a valid Bangladeshi phone number",
        ],
      },
    },

    // ── Linked order (optional but recommended) ───────────────────────────────
    orderNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // ── Complaint body ───────────────────────────────────────────────────────
    category: {
      type: String,
      enum: [
        "wrong_product", // ভুল পণ্য পেয়েছি
        "damaged_product", // পণ্য নষ্ট
        "missing_item", // পণ্য পাইনি
        "delivery_issue", // ডেলিভারি সমস্যা
        "payment_issue", // পেমেন্ট সমস্যা
        "refund_request", // রিফান্ড চাই
        "quality_issue", // মানসম্পন্ন নয়
        "late_delivery", // দেরিতে ডেলিভারি
        "rude_behavior", // অভদ্র আচরণ
        "other", // অন্যান্য
      ],
      required: [true, "Complaint category is required"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [20, "Please provide at least 20 characters of description"],
      maxlength: [3000, "Description cannot exceed 3000 characters"],
    },

    // ── Evidence / Attachments (Cloudinary URLs) ─────────────────────────────
    attachments: [
      {
        url: String,
        publicId: String,
        fileName: String,
        fileType: String, // image/jpeg, image/png, application/pdf
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Priority (auto-calculated + admin override) ───────────────────────────
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // ── Lifecycle status ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "open", // নতুন অভিযোগ — কেউ দেখেনি
        "under_review", // রিভিউয়ের মধ্যে
        "on_hold", // অতিরিক্ত তথ্যের অপেক্ষায়
        "escalated", // উচ্চতর পর্যায়ে
        "resolved", // সমাধান হয়েছে
        "rejected", // বাতিল (ভুয়া / ডুপ্লিকেট)
        "closed", // আর্কাইভ
      ],
      default: "open",
      index: true,
    },

    // ── Resolution ───────────────────────────────────────────────────────────
    resolution: {
      type: {
        type: String,
        enum: [
          "refund",
          "replacement",
          "discount_coupon",
          "apology",
          "no_action",
          "other",
        ],
      },
      details: String,
      couponCode: String,
      refundAmount: { type: Number, min: 0 },
      resolvedAt: Date,
      resolvedBy: String,
    },

    // ── Rejection ────────────────────────────────────────────────────────────
    rejectionReason: {
      type: String,
      enum: [
        "duplicate",
        "invalid_claim",
        "out_of_policy",
        "insufficient_evidence",
        "abusive_content",
        "other",
      ],
    },
    rejectionNote: String,

    // ── Hold reason ──────────────────────────────────────────────────────────
    holdReason: String,

    // ── Conversation thread ───────────────────────────────────────────────────
    replies: [replySchema],

    // ── Status change log ────────────────────────────────────────────────────
    statusHistory: [statusHistorySchema],

    // ── Admin metadata ───────────────────────────────────────────────────────
    assignedTo: String, // Admin name / email
    internalNotes: String,

    // ── Customer satisfaction (post-resolution) ───────────────────────────────
    satisfactionRating: {
      score: { type: Number, min: 1, max: 5 },
      feedback: String,
      ratedAt: Date,
    },

    // ── Spam / fraud guard ────────────────────────────────────────────────────
    ipAddress: String,
    userAgent: String,
    isFlagged: { type: Boolean, default: false },
    flagReason: String,

    // ── SLA tracking ─────────────────────────────────────────────────────────
    firstResponseAt: Date,
    resolvedAt: Date,
    slaBreached: { type: Boolean, default: false },

    // ── Email log ────────────────────────────────────────────────────────────
    emailsSent: [
      {
        type: { type: String },
        sentAt: { type: Date, default: Date.now },
        recipient: String,
        success: Boolean,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// ── Auto-generate ticket number ───────────────────────────────────────────────
complaintSchema.pre("save", async function () {
  if (!this.ticketNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(10000 + Math.random() * 90000);
    this.ticketNumber = `TKT-${year}${month}-${rand}`;
  }
});

// ── Auto-calculate priority based on category ─────────────────────────────────
complaintSchema.pre("save", function () {
  if (this.isNew && this.priority === "medium") {
    const urgentCategories = [
      "missing_item",
      "payment_issue",
      "refund_request",
    ];
    const highCategories = [
      "damaged_product",
      "wrong_product",
      "rude_behavior",
    ];
    if (urgentCategories.includes(this.category)) this.priority = "urgent";
    else if (highCategories.includes(this.category)) this.priority = "high";
  }
});

// ── Indexes ──────────────────────────────────────────────────────────────────
complaintSchema.index({ "customer.email": 1 });
complaintSchema.index({ "customer.phone": 1 });
complaintSchema.index({ orderNumber: 1 });
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ isFlagged: 1 });

// ── Virtual: SLA hours elapsed ───────────────────────────────────────────────
complaintSchema.virtual("hoursOpen").get(function () {
  const end = this.resolvedAt || new Date();
  return Math.round((end - this.createdAt) / (1000 * 60 * 60));
});

module.exports = mongoose.model("Complaint", complaintSchema);
