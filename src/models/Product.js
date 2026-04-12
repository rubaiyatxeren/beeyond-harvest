const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    nameBn: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    descriptionBn: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    comparePrice: {
      type: Number,
      min: [0, "Compare price cannot be negative"],
    },
    // ── PROFIT TRACKING FIELDS ─────────────────────────────────────────────
    costPerUnit: {
      type: Number,
      min: [0, "Cost per unit cannot be negative"],
      default: 0,
      comment: "Your actual purchase/production cost per unit (COGS)",
    },
    packagingCost: {
      type: Number,
      min: [0, "Packaging cost cannot be negative"],
      default: 0,
      comment: "Box, tape, label cost per unit",
    },
    // ──────────────────────────────────────────────────────────────────────
    costPerItem: {
      type: Number,
      min: [0, "Cost per item cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    images: [
      {
        url: String,
        publicId: String,
        isMain: {
          type: Boolean,
          default: false,
        },
      },
    ],
    tags: [String],
    weight: {
      type: Number,
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    metaTitle: String,
    metaDescription: String,
  },
  {
    timestamps: true,
  },
);

productSchema.pre("save", function () {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
});

module.exports = mongoose.model("Product", productSchema);
