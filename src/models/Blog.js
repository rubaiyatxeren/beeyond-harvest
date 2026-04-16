const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    isApproved: { type: Boolean, default: false },
    approvedAt: { type: Date },
    ip: { type: String }, // For spam/fraud tracking
    likes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    ogImage: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    noIndex: { type: Boolean, default: false },
  },
  { _id: false },
);

// ─── Main Blog Schema ─────────────────────────────────────────────────────────

const blogSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, "Excerpt cannot exceed 500 characters"],
    },
    body: {
      type: String,
      required: [true, "Blog body is required"],
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    coverImage: {
      url: { type: String, trim: true },
      alt: { type: String, trim: true },
      credit: { type: String, trim: true },
    },
    gallery: [
      {
        url: { type: String, trim: true },
        alt: { type: String, trim: true },
        _id: false,
      },
    ],

    // ── Authorship ────────────────────────────────────────────────────────────
    author: {
      name: { type: String, required: true, trim: true },
      bio: { type: String, trim: true },
      avatar: { type: String, trim: true },
    },

    // ── Taxonomy ──────────────────────────────────────────────────────────────
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) => tags.map((t) => t.toLowerCase().trim()),
    },

    // ── Status & Visibility ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "published", "archived", "scheduled"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },
    isFeatured: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },

    // ── Content Settings ──────────────────────────────────────────────────────
    readingTime: { type: Number }, // in minutes, auto-calculated
    contentLanguage: { type: String, default: "bn", enum: ["bn", "en"] }, // Bengali default
    allowComments: { type: Boolean, default: true },

    // ── Related Content ───────────────────────────────────────────────────────
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Blog" }],

    // ── Engagement ────────────────────────────────────────────────────────────
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: [commentSchema],

    // ── SEO ───────────────────────────────────────────────────────────────────
    seo: { type: seoSchema, default: {} },

    // ── Admin ─────────────────────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null }, // soft delete
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ isFeatured: 1, status: 1 });
blogSchema.index({
  title: "text",
  excerpt: "text",
  body: "text",
  tags: "text",
});

// ─── Virtuals ─────────────────────────────────────────────────────────────────

blogSchema.virtual("commentCount").get(function () {
  return this.comments?.filter((c) => c.isApproved).length ?? 0;
});

blogSchema.virtual("isPublished").get(function () {
  return this.status === "published";
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────

blogSchema.pre("save", async function () {
  if (!this.slug) {
    this.slug = generateSlug(this.title);
  }

  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  if (this.isModified("body")) {
    const wordCount = this.body.trim().split(/\s+/).length;
    this.readingTime = Math.max(1, Math.ceil(wordCount / 200));
  }

  if (!this.excerpt && this.body) {
    const stripped = this.body.replace(/<[^>]+>/g, "");
    this.excerpt =
      stripped.slice(0, 250).trim() + (stripped.length > 250 ? "…" : "");
  }
});

// ─── Static Methods ───────────────────────────────────────────────────────────

/**
 * Get published posts with optional category/tag filtering.
 */
blogSchema.statics.getPublished = function (filter = {}) {
  return this.find({
    status: "published",
    deletedAt: null,
    ...filter,
  }).sort({ isPinned: -1, publishedAt: -1 });
};

/**
 * Increment views atomically.
 */
blogSchema.statics.incrementViews = function (id) {
  return this.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
};

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Soft delete — preserves data for analytics.
 */
blogSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.status = "archived";
  return this.save();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/--+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim hyphens
    .slice(0, 100); // max length
}

module.exports = mongoose.model("Blog", blogSchema);
module.exports.generateSlug = generateSlug;
