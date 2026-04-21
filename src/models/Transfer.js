// models/Transfer.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const transferSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    transferId: {
      type: String,
      unique: true,
      // e.g. "BT-20250421-A3F7K"
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    sender: {
      email: {
        type: String,
        required: [true, "Sender email is required"],
        lowercase: true,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
        default: "",
      },
    },
    receiver: {
      email: {
        type: String,
        required: [true, "Receiver email is required"],
        lowercase: true,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ── Files ─────────────────────────────────────────────────────────────────
    files: [
      {
        originalName: { type: String, required: true },
        storedName: { type: String, required: true }, // UUID-based name on disk/cloud
        mimetype: { type: String, default: "application/octet-stream" },
        sizeBytes: { type: Number, required: true },
        cloudinaryUrl: { type: String, default: "" }, // populated if using Cloudinary
        cloudinaryPublicId: { type: String, default: "" },
        downloadCount: { type: Number, default: 0 },
      },
    ],

    // ── Optional message from sender ─────────────────────────────────────────
    message: {
      type: String,
      maxlength: [500, "Message cannot exceed 500 characters"],
      default: "",
    },

    // ── OTP & verification ────────────────────────────────────────────────────
    otp: {
      code: { type: String, select: false }, // hashed OTP
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0 },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
    },

    // ── State ─────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending_otp",
        "otp_verified",
        "sent",
        "downloaded",
        "expired",
        "failed",
      ],
      default: "pending_otp",
    },

    // ── Expiry (links expire after 7 days) ────────────────────────────────────
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      index: { expires: 0 }, // TTL index — MongoDB auto-deletes expired docs
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    totalSizeBytes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── Pre-save: generate transferId ─────────────────────────────────────────────
transferSchema.pre("save", async function () {
  // Generate transferId if missing
  if (!this.transferId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    this.transferId = `BT-${year}${month}${day}-${rand}`;
  }

  // Keep totalSizeBytes in sync
  if (this.isModified("files")) {
    this.totalSizeBytes = this.files.reduce(
      (s, f) => s + (f.sizeBytes || 0),
      0,
    );
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
transferSchema.index({ "sender.email": 1, createdAt: -1 });
transferSchema.index({ "receiver.email": 1, createdAt: -1 });
transferSchema.index({ status: 1 });

module.exports = mongoose.model("Transfer", transferSchema);
