const mongoose = require("mongoose");

/**
 * Transaction — unified model for all financial entries.
 * Covers expenses, income, and transfers between accounts.
 */
const transactionSchema = new mongoose.Schema(
  {
    // ── Type ─────────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: ["income", "expense", "transfer"],
      required: [true, "Transaction type is required"],
      index: true,
    },

    // ── Core Fields ──────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Transaction title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: {
      type: String,
      default: "BDT",
      trim: true,
    },

    // ── Category ─────────────────────────────────────────────────────────
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    subcategory: {
      type: String,
      trim: true,
    },

    // ── Date & Time ──────────────────────────────────────────────────────
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      default: Date.now,
      index: true,
    },

    // ── Account / Payment Method ─────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "bkash",
        "nagad",
        "rocket",
        "bank_transfer",
        "card",
        "cheque",
        "other",
      ],
      default: "cash",
    },
    account: {
      type: String,
      trim: true,
      comment: "e.g. 'Main Business Account', 'Petty Cash', 'bKash Business'",
    },

    // ── References ───────────────────────────────────────────────────────
    referenceType: {
      type: String,
      enum: [
        "order",
        "product",
        "supplier",
        "manual",
        "salary",
        "utility",
        "marketing",
        "other",
      ],
      default: "manual",
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      comment: "Link to Order, Product, or other document",
    },
    referenceNumber: {
      type: String,
      trim: true,
      comment: "Human-readable ref like order number or invoice number",
    },

    // ── Recurring ────────────────────────────────────────────────────────
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringInterval: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", null],
      default: null,
    },
    recurringParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },

    // ── Tax ──────────────────────────────────────────────────────────────
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Tags & Notes ─────────────────────────────────────────────────────
    tags: [{ type: String, trim: true }],
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // ── Attachments ──────────────────────────────────────────────────────
    attachments: [
      {
        url: String,
        publicId: String,
        filename: String,
        type: {
          type: String,
          enum: ["receipt", "invoice", "screenshot", "other"],
          default: "receipt",
        },
      },
    ],

    // ── Approval / Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "void"],
      default: "approved",
      index: true,
    },
    approvedBy: {
      type: String,
      trim: true,
    },

    // ── Budget Tracking ──────────────────────────────────────────────────
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Budget",
      default: null,
    },

    // ── Vendor / Payee / Payer ────────────────────────────────────────────
    party: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      type: {
        type: String,
        enum: ["supplier", "customer", "employee", "utility", "other"],
        default: "other",
      },
    },

    // ── Created By ───────────────────────────────────────────────────────
    createdBy: {
      type: String,
      default: "admin",
    },

    // ── Transfer Fields ──────────────────────────────────────────────────
    fromAccount: { type: String, trim: true },
    toAccount: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

// ── Compound indexes for analytics ───────────────────────────────────────────
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ type: 1, category: 1, date: -1 });
transactionSchema.index({ date: -1, status: 1 });
transactionSchema.index({ referenceType: 1, referenceId: 1 });
transactionSchema.index({
  "party.name": "text",
  title: "text",
  description: "text",
});

module.exports = mongoose.model("Transaction", transactionSchema);
