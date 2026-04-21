const crypto = require("crypto");
const Review = require("../models/Review");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendEmail } = require("../utils/emailService");
const {
  generateReviewToken,
  verifyReviewToken,
  hashToken,
} = require("../utils/reviewToken");
const { generateReviewRequestEmail } = require("../utils/reviewEmailTemplate");

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Recompute and save product's average rating from all approved reviews */
async function syncProductRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: productId, status: "approved" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = result[0]?.avg ?? 0;
  const count = result[0]?.count ?? 0;

  await Product.findByIdAndUpdate(productId, {
    "ratings.average": Math.round(avg * 10) / 10,
    "ratings.count": count,
  });

  return { avg, count };
}

// ─── PUBLIC: Validate a review token ─────────────────────────────────────────
// GET /api/reviews/validate-token?token=xxx
// Called by the frontend review page to pre-fill product/order info
const validateToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Token required" });

    // Verify JWT signature + expiry
    let payload;
    try {
      payload = verifyReviewToken(token);
    } catch {
      return res.status(400).json({
        success: false,
        message: "লিংকটি মেয়াদোত্তীর্ণ বা অকার্যকর।",
        code: "TOKEN_INVALID",
      });
    }

    const { orderId, productId, email } = payload;
    const tokenHash = hashToken(token);

    // Check if already used
    const existing = await Review.findOne({ reviewToken: tokenHash });
    if (existing?.tokenUsed) {
      return res.status(400).json({
        success: false,
        message: "এই লিংক দিয়ে ইতিমধ্যে একটি রিভিউ দেওয়া হয়েছে।",
        code: "TOKEN_USED",
      });
    }

    // Fetch order + product for the UI
    const [order, product] = await Promise.all([
      Order.findById(orderId).select("orderNumber customer items orderStatus"),
      Product.findById(productId).select("name images ratings"),
    ]);

    if (!order || !product) {
      return res
        .status(404)
        .json({ success: false, message: "Order or product not found" });
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "অর্ডার ডেলিভারি সম্পন্ন হলেই রিভিউ দেওয়া যাবে।",
        code: "NOT_DELIVERED",
      });
    }

    // Confirm the product is actually in this order
    const itemInOrder = order.items.find(
      (i) => String(i.product) === productId,
    );
    if (!itemInOrder) {
      return res
        .status(400)
        .json({ success: false, message: "Product not found in this order" });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        customerEmail: email,
        product: {
          _id: product._id,
          name: product.name,
          image: product.images?.[0]?.url ?? null,
          ratings: product.ratings,
        },
      },
    });
  } catch (err) {
    console.error("❌ [REVIEW] validateToken error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUBLIC: Submit a review ──────────────────────────────────────────────────
// POST /api/reviews
const submitReview = async (req, res) => {
  try {
    const { token, rating, title, body } = req.body;

    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Token required" });
    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be 1–5" });
    }

    // Verify token
    let payload;
    try {
      payload = verifyReviewToken(token);
    } catch {
      return res.status(400).json({
        success: false,
        message: "লিংকটি মেয়াদোত্তীর্ণ বা অকার্যকর।",
        code: "TOKEN_INVALID",
      });
    }

    const { orderId, productId, email } = payload;
    const tokenHash = hashToken(token);

    // Check already used (atomic: findOneAndUpdate with tokenUsed: false)
    const lockResult = await Review.findOneAndUpdate(
      { reviewToken: tokenHash, tokenUsed: false },
      { tokenUsed: true },
    );

    // If no doc found but review already exists for this order+product → already reviewed
    const alreadyExists = await Review.findOne({
      order: orderId,
      product: productId,
    });

    if (alreadyExists && !lockResult) {
      return res.status(400).json({
        success: false,
        message: "এই পণ্যে আপনি ইতিমধ্যে রিভিউ দিয়েছেন।",
        code: "ALREADY_REVIEWED",
      });
    }

    // Fetch order for customer info
    const order = await Order.findById(orderId).select(
      "orderNumber customer orderStatus",
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "অর্ডার ডেলিভারি সম্পন্ন হলেই রিভিউ দেওয়া যাবে।",
      });
    }

    // Confirm email matches
    if (order.customer.email.toLowerCase() !== email.toLowerCase()) {
      return res
        .status(403)
        .json({ success: false, message: "Token mismatch" });
    }

    // Create or update the review doc
    // (findOneAndUpdate with upsert handles race conditions cleanly)
    const review = await Review.findOneAndUpdate(
      { order: orderId, product: productId },
      {
        $setOnInsert: {
          order: orderId,
          product: productId,
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          customerEmail: email,
          customerPhone: order.customer.phone,
          isVerifiedPurchase: true,
          reviewToken: tokenHash,
          tokenUsed: true,
        },
        $set: {
          rating: Number(rating),
          title: (title || "").trim(),
          body: (body || "").trim(),
          status: "pending", // admin must approve
        },
      },
      { upsert: true, new: true },
    );

    // Sync product rating (only approved reviews count — pending won't affect avg yet)
    await syncProductRating(review.product);

    console.log(
      `⭐ [REVIEW] New review: ${review._id} | order ${order.orderNumber} | rating ${rating}`,
    );

    res.status(201).json({
      success: true,
      message: "রিভিউ সফলভাবে জমা হয়েছে। অনুমোদনের পর প্রকাশিত হবে।",
      data: { reviewId: review._id },
    });
  } catch (err) {
    console.error("❌ [REVIEW] submitReview error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUBLIC: Get approved reviews for a product ───────────────────────────────
// GET /api/reviews/product/:productId
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const sortMap = {
      newest: { createdAt: -1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      helpful: { helpfulVotes: -1, createdAt: -1 },
    };
    const sort = sortMap[req.query.sort] || sortMap.newest;

    const [reviews, total, ratingBreakdown, product] = await Promise.all([
      Review.find({ product: productId, status: "approved" })
        .select(
          "customerName rating title body helpfulVotes notHelpfulVotes isVerifiedPurchase createdAt",
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ product: productId, status: "approved" }),
      Review.aggregate([
        {
          $match: {
            product: new (require("mongoose").Types.ObjectId)(productId),
            status: "approved",
          },
        },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
      Product.findById(productId).select("ratings").lean(),
    ]);

    // Build { 1: N, 2: N, 3: N, 4: N, 5: N } breakdown
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingBreakdown.forEach((r) => {
      breakdown[r._id] = r.count;
    });

    res.json({
      success: true,
      data: {
        reviews,
        summary: {
          average: product?.ratings?.average ?? 0,
          count: total,
          breakdown,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("❌ [REVIEW] getProductReviews error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUBLIC: Vote helpful/not-helpful ────────────────────────────────────────
// POST /api/reviews/:id/vote
// body: { helpful: true|false, voterEmail: "..." }  (email from token on frontend)
const voteReview = async (req, res) => {
  try {
    const { helpful, voterEmail } = req.body;
    if (typeof helpful !== "boolean" || !voterEmail) {
      return res.status(400).json({
        success: false,
        message: "helpful (bool) and voterEmail required",
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review || review.status !== "approved") {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    if (review.voterEmails.includes(voterEmail.toLowerCase())) {
      return res
        .status(400)
        .json({ success: false, message: "ইতিমধ্যে ভোট দেওয়া হয়েছে।" });
    }

    review.voterEmails.push(voterEmail.toLowerCase());
    if (helpful) review.helpfulVotes += 1;
    else review.notHelpfulVotes += 1;

    await review.save();

    res.json({
      success: true,
      data: {
        helpfulVotes: review.helpfulVotes,
        notHelpfulVotes: review.notHelpfulVotes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Get all reviews (any status) ─────────────────────────────────────
// GET /api/reviews/admin
const adminGetReviews = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.product) filter.product = req.query.product;
    if (req.query.rating) filter.rating = Number(req.query.rating);

    if (req.query.search) {
      filter.$or = [
        { customerName: { $regex: req.query.search, $options: "i" } },
        { orderNumber: { $regex: req.query.search, $options: "i" } },
        { title: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("product", "name images")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Approve / reject / delete a review ───────────────────────────────
// PUT /api/reviews/admin/:id/moderate
const moderateReview = async (req, res) => {
  try {
    const { status, moderationNote } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be approved or rejected",
      });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        status,
        moderationNote: moderationNote || "",
        moderatedBy: req.user._id,
        moderatedAt: new Date(),
      },
      { new: true },
    );

    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });

    // Re-sync product rating after moderation decision
    await syncProductRating(review.product);

    console.log(
      `🛡️ [REVIEW] ${status}: ${review._id} by admin ${req.user._id}`,
    );

    res.json({
      success: true,
      data: review,
      message: `Review ${status} successfully`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Delete a review ───────────────────────────────────────────────────
// DELETE /api/reviews/admin/:id
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    await syncProductRating(review.product);
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── INTERNAL: Send review request emails after delivery ─────────────────────
// Called from orderController.updateOrderStatus when status → delivered
// NOT an HTTP route — exported as a utility
const sendReviewRequestEmails = async (order) => {
  try {
    if (process.env.DISABLE_EMAIL === "true") return;

    const shopUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Build one token + link per unique product in the order
    const reviewLinks = order.items.map((item) => {
      const token = generateReviewToken(
        order._id,
        item.product,
        order.customer.email,
      );
      const reviewUrl = `${shopUrl}/review?token=${token}`;
      return {
        productName: item.name,
        productId: String(item.product),
        reviewUrl,
        token,
      };
    });

    // Pre-create Review placeholder docs to track token hashes
    // (so we can detect token reuse even before submission)
    const placeholders = reviewLinks.map((rl) => ({
      updateOne: {
        filter: { order: order._id, product: rl.productId },
        update: {
          $setOnInsert: {
            order: order._id,
            product: rl.productId,
            orderNumber: order.orderNumber,
            customerName: order.customer.name,
            customerEmail: order.customer.email,
            customerPhone: order.customer.phone,
            reviewToken: hashToken(rl.token),
            tokenUsed: false,
            status: "pending",
            rating: 0, // placeholder — will be filled on submit
            isVerifiedPurchase: true,
          },
        },
        upsert: true,
      },
    }));

    await Review.bulkWrite(placeholders, { ordered: false });

    // Send the email
    const html = generateReviewRequestEmail(order, reviewLinks);
    const result = await sendEmail(
      order.customer.email,
      `⭐ আপনার অর্ডার ${order.orderNumber} — রিভিউ দিন`,
      html,
    );

    if (result?.success) {
      console.log(
        `✅ [REVIEW EMAIL] Sent to ${order.customer.email} (${reviewLinks.length} products)`,
      );
    } else {
      console.error(`❌ [REVIEW EMAIL] Failed: ${result?.error}`);
    }
  } catch (err) {
    console.error("❌ [REVIEW EMAIL] Crashed:", err.message);
  }
};

module.exports = {
  validateToken,
  submitReview,
  getProductReviews,
  voteReview,
  adminGetReviews,
  moderateReview,
  deleteReview,
  sendReviewRequestEmails, // used by orderController
};
