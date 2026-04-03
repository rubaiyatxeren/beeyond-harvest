const Coupon = require("../models/Coupon");

// ─── Helper ────────────────────────────────────────────────────────────────

const evaluateCoupon = (coupon, orderSubtotal) => {
  const now = new Date();

  if (!coupon.isActive) {
    return { valid: false, discount: 0, reason: "এই কুপনটি নিষ্ক্রিয়।" };
  }

  if (coupon.startDate && now < new Date(coupon.startDate)) {
    return { valid: false, discount: 0, reason: "কুপনটি এখনো শুরু হয়নি।" };
  }
  if (coupon.endDate && now > new Date(coupon.endDate)) {
    return {
      valid: false,
      discount: 0,
      reason: "কুপনের মেয়াদ শেষ হয়ে গেছে।",
    };
  }

  if (
    coupon.usageLimit !== undefined &&
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return {
      valid: false,
      discount: 0,
      reason: "কুপনের ব্যবহার সীমা শেষ হয়ে গেছে।",
    };
  }

  if (orderSubtotal < (coupon.minimumOrder || 0)) {
    return {
      valid: false,
      discount: 0,
      reason: `এই কুপন ব্যবহার করতে কমপক্ষে ৳${coupon.minimumOrder} এর অর্ডার করতে হবে।`,
    };
  }

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (orderSubtotal * coupon.discountValue) / 100;
    if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
  } else {
    discount = coupon.discountValue;
    if (discount > orderSubtotal) discount = orderSubtotal;
  }

  discount = Math.round(discount * 100) / 100;

  return { valid: true, discount, reason: null };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// @desc    Get all coupons (admin)
// @route   GET /api/coupons
// @access  Private
const getCoupons = async (req, res) => {
  console.log("🎟️  GET /api/coupons called");
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.isActive !== undefined)
      query.isActive = req.query.isActive === "true";
    if (req.query.search)
      query.code = { $regex: req.query.search, $options: "i" };

    const [coupons, total] = await Promise.all([
      Coupon.find(query).sort("-createdAt").skip(skip).limit(limit).lean(),
      Coupon.countDocuments(query),
    ]);

    console.log(`✅ Found ${coupons.length} coupons (page ${page})`);
    res.json({
      success: true,
      data: coupons,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("❌ getCoupons error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single coupon by ID (admin)
// @route   GET /api/coupons/:id
// @access  Private
const getCoupon = async (req, res) => {
  console.log(`🎟️  GET /api/coupons/${req.params.id}`);
  try {
    const coupon = await Coupon.findById(req.params.id).lean();
    if (!coupon)
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });

    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error("❌ getCoupon error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Validate a coupon code for a given subtotal (PUBLIC — used by checkout)
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = async (req, res) => {
  console.log("🎟️  POST /api/coupons/validate", req.body);
  try {
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "code এবং subtotal প্রয়োজন।" });
    }

    const orderSubtotal = parseFloat(subtotal) || 0;

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "কুপন কোডটি পাওয়া যায়নি।" });
    }

    const { valid, discount, reason } = evaluateCoupon(coupon, orderSubtotal);
    if (!valid) {
      return res.status(400).json({ success: false, message: reason });
    }

    console.log(
      `✅ Coupon ${coupon.code} valid — discount: ৳${discount} on ৳${orderSubtotal}`,
    );

    res.json({
      success: true,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount,
        minimumOrder: coupon.minimumOrder,
        maximumDiscount: coupon.maximumDiscount,
      },
    });
  } catch (error) {
    console.error("❌ validateCoupon error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply coupon — increments usedCount (call AFTER order is created)
// @route   POST /api/coupons/apply
// @access  Public
const applyCoupon = async (req, res) => {
  console.log("🎟️  POST /api/coupons/apply", req.body);
  try {
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "code এবং subtotal প্রয়োজন।" });
    }

    const orderSubtotal = parseFloat(subtotal) || 0;

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "কুপন কোডটি পাওয়া যায়নি।" });
    }

    const { valid, discount, reason } = evaluateCoupon(coupon, orderSubtotal);
    if (!valid) {
      return res.status(400).json({ success: false, message: reason });
    }

    // Atomic increment — safe against concurrent orders
    await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });

    console.log(
      `✅ Coupon ${coupon.code} applied — usedCount now ${coupon.usedCount + 1}`,
    );

    res.json({
      success: true,
      message: "কুপন সফলভাবে প্রয়োগ করা হয়েছে।",
      data: { code: coupon.code, discount },
    });
  } catch (error) {
    console.error("❌ applyCoupon error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create coupon (admin)
// @route   POST /api/coupons
// @access  Private
const createCoupon = async (req, res) => {
  console.log("🎟️  POST /api/coupons (create)", req.body);
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumOrder,
      maximumDiscount,
      startDate,
      endDate,
      usageLimit,
      isActive,
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "code, discountType, এবং discountValue প্রয়োজন।",
      });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `"${code.toUpperCase()}" কোড দিয়ে একটি কুপন ইতোমধ্যে আছে।`,
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      description,
      discountType,
      discountValue,
      minimumOrder: minimumOrder || 0,
      maximumDiscount: maximumDiscount || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      usageLimit: usageLimit || undefined,
      isActive: isActive !== undefined ? isActive : true,
    });

    console.log(`✅ Coupon created: ${coupon.code}`);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    console.error("❌ createCoupon error:", error.message);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "এই কুপন কোডটি ইতোমধ্যে ব্যবহৃত হয়েছে।",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update coupon (admin)
// @route   PUT /api/coupons/:id
// @access  Private
const updateCoupon = async (req, res) => {
  console.log(`🎟️  PUT /api/coupons/${req.params.id}`, req.body);
  try {
    let coupon = await Coupon.findById(req.params.id);
    if (!coupon)
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });

    if (req.body.code) {
      req.body.code = req.body.code.toUpperCase().trim();
      const conflict = await Coupon.findOne({
        code: req.body.code,
        _id: { $ne: coupon._id },
      });
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `"${req.body.code}" কোড দিয়ে অন্য একটি কুপন আছে।`,
        });
      }
    }

    coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    console.log(`✅ Coupon updated: ${coupon.code}`);
    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error("❌ updateCoupon error:", error.message);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "এই কুপন কোডটি ইতোমধ্যে ব্যবহৃত হয়েছে।",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle coupon active/inactive (admin)
// @route   PATCH /api/coupons/:id/toggle
// @access  Private
const toggleCoupon = async (req, res) => {
  console.log(`🎟️  PATCH /api/coupons/${req.params.id}/toggle`);
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon)
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    console.log(`✅ Coupon ${coupon.code} → isActive: ${coupon.isActive}`);
    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"}`,
      data: coupon,
    });
  } catch (error) {
    console.error("❌ toggleCoupon error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete coupon (admin)
// @route   DELETE /api/coupons/:id
// @access  Private
const deleteCoupon = async (req, res) => {
  console.log(`🎟️  DELETE /api/coupons/${req.params.id}`);
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon)
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });

    console.log(`✅ Coupon deleted: ${coupon.code}`);
    res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("❌ deleteCoupon error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get coupon stats (admin)
// @route   GET /api/coupons/stats
// @access  Private
const getCouponStats = async (req, res) => {
  console.log("📊 GET /api/coupons/stats");
  try {
    const now = new Date();

    const [total, active, expired, exhausted] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({
        isActive: true,
        $or: [{ endDate: null }, { endDate: { $gte: now } }],
      }),
      Coupon.countDocuments({ endDate: { $lt: now } }),
      Coupon.countDocuments({
        $expr: {
          $and: [
            { $ne: ["$usageLimit", null] },
            { $gte: ["$usedCount", "$usageLimit"] },
          ],
        },
      }),
    ]);

    const topUsed = await Coupon.find({ usedCount: { $gt: 0 } })
      .sort("-usedCount")
      .limit(5)
      .select("code discountType discountValue usedCount usageLimit isActive")
      .lean();

    res.json({
      success: true,
      data: { total, active, expired, exhausted, topUsed },
    });
  } catch (error) {
    console.error("❌ getCouponStats error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  getCoupons,
  getCoupon,
  validateCoupon,
  applyCoupon,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  getCouponStats,
};
