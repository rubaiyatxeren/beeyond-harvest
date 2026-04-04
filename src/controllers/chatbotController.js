const Order = require("../models/Order");
const Product = require("../models/Product");
const DeliveryCharge = require("../models/DeliveryCharge");
const Coupon = require("../models/Coupon");

// ─── NLP Engine ──────────────────────────────────────────────────────────────

const INTENTS = {
  // Order tracking
  TRACK_ORDER: {
    patterns: [
      /অর্ডার.*(ট্র্যাক|খুঁজ|কোথায়|status|স্ট্যাটাস)/i,
      /track.*order/i,
      /order.*(status|track|where|কোথায়)/i,
      /আমার অর্ডার/i,
      /ORD-\d{6}-\d{5}/i,
      /অর্ডার নম্বর/i,
    ],
    extractors: {
      orderNumber: /\b(ORD-\d{6}-\d{5})\b/i,
      phone: /\b(01[3-9]\d{8})\b/,
    },
  },

  // Product search / availability
  PRODUCT_SEARCH: {
    patterns: [
      /পণ্য.*(আছে|পাওয়া|stock|স্টক)/i,
      /product.*(available|stock|কিনতে)/i,
      /দাম.*(কত|জানত)/i,
      /price.*(of|for|কত)/i,
      /কত টাকা/i,
      /কোন পণ্য/i,
      /available.*product/i,
    ],
  },

  // Delivery info
  DELIVERY_INFO: {
    patterns: [
      /ডেলিভারি.*(চার্জ|খরচ|সময়|কত|কবে)/i,
      /delivery.*(charge|cost|time|fee|how long)/i,
      /শিপিং/i,
      /shipping/i,
      /কতদিনে পাব/i,
      /কখন পাব/i,
    ],
  },

  // Coupon / discount
  COUPON_INFO: {
    patterns: [
      /কুপন/i,
      /coupon/i,
      /discount/i,
      /ছাড়/i,
      /offer/i,
      /অফার/i,
      /promo/i,
    ],
    extractors: {
      couponCode: /\b([A-Z0-9]{4,20})\b/,
    },
  },

  // Return / refund
  RETURN_REFUND: {
    patterns: [
      /রিটার্ন/i,
      /return/i,
      /refund/i,
      /ফেরত/i,
      /exchange/i,
      /বদলাতে/i,
      /ক্যান্সেল/i,
      /cancel/i,
    ],
  },

  // Payment methods
  PAYMENT_INFO: {
    patterns: [
      /পেমেন্ট/i,
      /payment/i,
      /bkash/i,
      /বিকাশ/i,
      /nagad/i,
      /নগদ/i,
      /cash/i,
      /ক্যাশ/i,
      /কিভাবে দিব/i,
    ],
  },

  // Contact / support
  CONTACT: {
    patterns: [
      /যোগাযোগ/i,
      /contact/i,
      /phone number/i,
      /ফোন/i,
      /email/i,
      /ইমেইল/i,
      /support/i,
      /সাপোর্ট/i,
      /help/i,
      /সাহায্য/i,
    ],
  },

  // Greeting
  GREETING: {
    patterns: [
      /^(hi|hello|হেলো|হ্যালো|সালাম|আস্সালামু|নমস্কার|hey|হাই)[\s!]*$/i,
      /^(good morning|good evening|শুভ সকাল|শুভ সন্ধ্যা)/i,
    ],
  },

  // Thanks
  THANKS: {
    patterns: [/ধন্যবাদ/i, /thank/i, /thanks/i, /শুকরিয়া/i, /জাজাকাল্লাহ/i],
  },
};

// ─── Intent Matcher ───────────────────────────────────────────────────────────

const detectIntent = (message) => {
  const msg = message.trim();

  for (const [intentName, intent] of Object.entries(INTENTS)) {
    for (const pattern of intent.patterns) {
      if (pattern.test(msg)) {
        const extracted = {};
        if (intent.extractors) {
          for (const [key, regex] of Object.entries(intent.extractors)) {
            const match = msg.match(regex);
            if (match) extracted[key] = match[1];
          }
        }
        return { intent: intentName, extracted };
      }
    }
  }

  return { intent: "UNKNOWN", extracted: {} };
};

// ─── Response Builders ────────────────────────────────────────────────────────

const buildOrderTrackResponse = async (extracted, message) => {
  // Try order number first
  const orderNumberMatch = message.match(/\b(ORD-\d{6}-\d{5})\b/i);
  const phoneMatch = message.match(/\b(01[3-9]\d{8})\b/);

  if (orderNumberMatch) {
    const order = await Order.findOne({
      orderNumber: { $regex: orderNumberMatch[1], $options: "i" },
    }).select(
      "orderNumber orderStatus paymentStatus customer.name items.name deliveryCharge total trackingNumber createdAt",
    );

    if (!order) {
      return {
        type: "error",
        text: `❌ **${orderNumberMatch[1]}** নম্বরের কোনো অর্ডার পাওয়া যায়নি। অর্ডার নম্বরটি সঠিক কিনা দেখুন।`,
        suggestions: ["আমার ফোন নম্বর দিয়ে খুঁজুন", "নতুন অর্ডার করুন"],
      };
    }

    const statusEmoji = {
      pending: "⏳",
      confirmed: "✅",
      processing: "⚙️",
      shipped: "🚚",
      delivered: "🎉",
      cancelled: "❌",
    };

    const statusBn = {
      pending: "অপেক্ষমাণ",
      confirmed: "নিশ্চিত",
      processing: "প্রক্রিয়াধীন",
      shipped: "শিপড",
      delivered: "ডেলিভারি সম্পন্ন",
      cancelled: "বাতিল",
    };

    return {
      type: "order_status",
      text: `🔍 **অর্ডার খুঁজে পাওয়া গেছে!**`,
      order: {
        number: order.orderNumber,
        status: order.orderStatus,
        statusBn: statusBn[order.orderStatus] || order.orderStatus,
        statusEmoji: statusEmoji[order.orderStatus] || "📦",
        paymentStatus: order.paymentStatus,
        customerName: order.customer?.name,
        trackingNumber: order.trackingNumber,
        total: order.total,
        date: order.createdAt,
        items: order.items?.map((i) => i.name).join(", "),
      },
      suggestions: ["আরেকটি অর্ডার ট্র্যাক করুন", "ডেলিভারি সম্পর্কে জানুন"],
    };
  }

  if (phoneMatch) {
    const orders = await Order.find({ "customer.phone": phoneMatch[1] })
      .select("orderNumber orderStatus total createdAt")
      .sort("-createdAt")
      .limit(5);

    if (!orders.length) {
      return {
        type: "error",
        text: `❌ **${phoneMatch[1]}** নম্বরে কোনো অর্ডার পাওয়া যায়নি।`,
        suggestions: ["নতুন অর্ডার করুন", "সাহায্যের জন্য যোগাযোগ করুন"],
      };
    }

    return {
      type: "order_list",
      text: `📋 **${phoneMatch[1]}** নম্বরে **${orders.length}টি** অর্ডার পাওয়া গেছে:`,
      orders: orders.map((o) => ({
        number: o.orderNumber,
        status: o.orderStatus,
        total: o.total,
        date: o.createdAt,
      })),
      suggestions: ["নির্দিষ্ট অর্ডার ট্র্যাক করুন", "ডেলিভারি সম্পর্কে জানুন"],
    };
  }

  return {
    type: "ask_info",
    text: `🔍 আপনার অর্ডার ট্র্যাক করতে **অর্ডার নম্বর** (যেমন: ORD-202504-12345) অথবা **ফোন নম্বর** লিখুন।`,
    suggestions: ["ORD-XXXXXX-XXXXX", "01XXXXXXXXX"],
  };
};

const buildProductSearchResponse = async (message) => {
  // Extract potential product name keywords
  const stopWords = [
    "আছে",
    "পাওয়া",
    "stock",
    "স্টক",
    "দাম",
    "কত",
    "টাকা",
    "price",
    "available",
    "product",
    "পণ্য",
    "কিনতে",
  ];
  const words = message
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !stopWords.some((sw) => w.toLowerCase().includes(sw.toLowerCase())),
    );

  let products = [];

  if (words.length > 0) {
    const searchRegex = words.map((w) => `(?=.*${w})`).join("");
    products = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: words.join("|"), $options: "i" } },
        { nameBn: { $regex: words.join("|"), $options: "i" } },
        { tags: { $in: words.map((w) => new RegExp(w, "i")) } },
      ],
    })
      .select("name nameBn price comparePrice stock images")
      .limit(5)
      .lean();
  }

  if (!products.length) {
    // Return featured/active products
    products = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .select("name nameBn price comparePrice stock")
      .sort("-isFeatured -createdAt")
      .limit(5)
      .lean();

    return {
      type: "product_list",
      text: `🛒 এখন **স্টকে** পাওয়া যাচ্ছে:`,
      products: products.map((p) => ({
        name: p.nameBn || p.name,
        price: p.price,
        comparePrice: p.comparePrice,
        stock: p.stock,
        inStock: p.stock > 0,
      })),
      suggestions: [
        "ডেলিভারি চার্জ কত?",
        "কুপন কোড আছে?",
        "অর্ডার ট্র্যাক করুন",
      ],
    };
  }

  return {
    type: "product_search",
    text: `🛍️ **${products.length}টি** পণ্য পাওয়া গেছে:`,
    products: products.map((p) => ({
      name: p.nameBn || p.name,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock,
      inStock: p.stock > 0,
    })),
    suggestions: ["অর্ডার করতে চাই", "ডেলিভারি চার্জ কত?"],
  };
};

const buildDeliveryResponse = async (message) => {
  const charges = await DeliveryCharge.find({ isActive: true }).lean();

  const inside = charges.find((c) => c.name === "inside_dhaka");
  const outside = charges.find((c) => c.name === "outside_dhaka");
  const special = charges.find((c) => c.name === "default");

  return {
    type: "delivery_info",
    text: `🚚 **ডেলিভারি চার্জ ও সময়:**`,
    charges: {
      insideDhaka: inside?.amount ?? 60,
      outsideDhaka: outside?.amount ?? 120,
      special: special
        ? { amount: special.amount, minOrder: special.minOrderAmount }
        : null,
    },
    deliveryTime: {
      insideDhaka: "১–২ কার্যদিবস",
      outsideDhaka: "২–৪ কার্যদিবস",
    },
    suggestions: ["কুপন কোড আছে?", "পেমেন্ট পদ্ধতি কী কী?", "অর্ডার করতে চাই"],
  };
};

const buildCouponResponse = async (message) => {
  // Check if a specific code was mentioned
  const codeMatch = message.match(/\b([A-Z0-9]{4,20})\b/);
  const now = new Date();

  if (codeMatch && !["ORDER", "TRACK", "INFO", "HELP"].includes(codeMatch[1])) {
    const coupon = await Coupon.findOne({
      code: codeMatch[1].toUpperCase(),
      isActive: true,
    }).lean();

    if (coupon) {
      const expired = coupon.endDate && now > new Date(coupon.endDate);
      const exhausted =
        coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;

      return {
        type: "coupon_detail",
        text:
          expired || exhausted
            ? `❌ **${coupon.code}** কুপনটি ${expired ? "মেয়াদ উত্তীর্ণ" : "শেষ হয়ে গেছে"}`
            : `✅ **${coupon.code}** কুপন বৈধ!`,
        coupon: {
          code: coupon.code,
          type: coupon.discountType,
          value: coupon.discountValue,
          minOrder: coupon.minimumOrder,
          maxDiscount: coupon.maximumDiscount,
          valid: !expired && !exhausted,
        },
        suggestions: ["অর্ডার করতে চাই", "ডেলিভারি চার্জ কত?"],
      };
    }
  }

  // Return active coupons (limited info)
  const activeCoupons = await Coupon.find({
    isActive: true,
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
    ],
  })
    .select("code discountType discountValue minimumOrder description")
    .limit(5)
    .lean();

  if (!activeCoupons.length) {
    return {
      type: "coupon_none",
      text: `😔 এই মুহূর্তে কোনো সক্রিয় কুপন নেই। শীঘ্রই অফার আসবে!`,
      suggestions: ["ডেলিভারি চার্জ কত?", "অর্ডার ট্র্যাক করুন"],
    };
  }

  return {
    type: "coupon_list",
    text: `🎟️ **${activeCoupons.length}টি** সক্রিয় কুপন পাওয়া গেছে:`,
    coupons: activeCoupons.map((c) => ({
      code: c.code,
      type: c.discountType,
      value: c.discountValue,
      minOrder: c.minimumOrder,
      description: c.description,
    })),
    suggestions: ["কুপন কোড যাচাই করুন", "অর্ডার করতে চাই"],
  };
};

// ─── Static Response Builders ─────────────────────────────────────────────────

const buildReturnResponse = () => ({
  type: "return_info",
  text: `↩️ **রিটার্ন ও রিফান্ড নীতি:**`,
  points: [
    "✅ পণ্য পাওয়ার **৭ দিনের** মধ্যে রিটার্ন করা যাবে",
    "✅ পণ্য অক্ষত ও মূল প্যাকেজিংসহ থাকতে হবে",
    "✅ রিফান্ড ৩–৫ কার্যদিবসের মধ্যে প্রদান করা হবে",
    "❌ ব্যবহৃত বা ক্ষতিগ্রস্ত পণ্য রিটার্ন গ্রহণযোগ্য নয়",
  ],
  contact: "support@beeharvest.com.bd",
  suggestions: ["যোগাযোগ করুন", "অর্ডার ট্র্যাক করুন"],
});

const buildPaymentResponse = () => ({
  type: "payment_info",
  text: `💳 **পেমেন্ট পদ্ধতিসমূহ:**`,
  methods: [
    { name: "💵 ক্যাশ অন ডেলিভারি", desc: "পণ্য পাওয়ার পর নগদ পেমেন্ট" },
    { name: "📱 বিকাশ", desc: "মোবাইল ব্যাংকিং" },
    { name: "📱 নগদ", desc: "মোবাইল ব্যাংকিং" },
    { name: "📱 রকেট", desc: "মোবাইল ব্যাংকিং" },
    { name: "💳 কার্ড", desc: "ডেবিট / ক্রেডিট কার্ড" },
  ],
  suggestions: ["ডেলিভারি চার্জ কত?", "কুপন কোড আছে?"],
});

const buildContactResponse = () => ({
  type: "contact_info",
  text: `📞 **আমাদের সাথে যোগাযোগ করুন:**`,
  channels: [
    { icon: "📧", label: "ইমেইল", value: "support@beeharvest.com.bd" },
    { icon: "💬", label: "Facebook", value: "facebook.com/beeharvest" },
    { icon: "📱", label: "WhatsApp", value: "01XXXXXXXXX" },
  ],
  hours: "সকাল ৯টা – রাত ৯টা (প্রতিদিন)",
  suggestions: ["অর্ডার ট্র্যাক করুন", "রিটার্ন নীতি জানুন"],
});

const buildGreetingResponse = async () => {
  const totalOrders = await Order.countDocuments();
  const productCount = await Product.countDocuments({
    isActive: true,
    stock: { $gt: 0 },
  });

  return {
    type: "greeting",
    text: `🐝 **আস্সালামু আলাইকুম! BeeHarvest-এ স্বাগতম!**\n\nআমি আপনার সহায়তার জন্য এখানে আছি। আমি কীভাবে সাহায্য করতে পারি?`,
    stats: { totalOrders, productCount },
    suggestions: [
      "আমার অর্ডার ট্র্যাক করুন",
      "কী পণ্য আছে?",
      "ডেলিভারি চার্জ কত?",
      "কুপন কোড আছে?",
    ],
  };
};

const buildUnknownResponse = () => ({
  type: "unknown",
  text: `🤔 আমি আপনার প্রশ্নটি বুঝতে পারিনি। নিচের বিষয়গুলো সম্পর্কে আমি সাহায্য করতে পারি:`,
  topics: [
    "📦 অর্ডার ট্র্যাকিং",
    "🛍️ পণ্য তথ্য ও দাম",
    "🚚 ডেলিভারি চার্জ",
    "🎟️ কুপন ও অফার",
    "↩️ রিটার্ন ও রিফান্ড",
    "💳 পেমেন্ট পদ্ধতি",
  ],
  suggestions: [
    "অর্ডার ট্র্যাক করুন",
    "ডেলিভারি চার্জ কত?",
    "কুপন আছে?",
    "যোগাযোগ করুন",
  ],
});

// ─── Smart Context Memory (session-based) ─────────────────────────────────────

const sessionContext = new Map(); // sessionId -> { lastIntent, data, timestamp }

const getContext = (sessionId) => {
  const ctx = sessionContext.get(sessionId);
  if (ctx && Date.now() - ctx.timestamp < 30 * 60 * 1000) return ctx; // 30 min TTL
  return null;
};

const setContext = (sessionId, data) => {
  sessionContext.set(sessionId, { ...data, timestamp: Date.now() });
  // Cleanup old sessions (keep max 1000)
  if (sessionContext.size > 1000) {
    const oldest = [...sessionContext.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    )[0];
    sessionContext.delete(oldest[0]);
  }
};

// ─── Main Chat Handler ────────────────────────────────────────────────────────

// @desc    Process chatbot message
// @route   POST /api/chatbot/message
// @access  Public
const processMessage = async (req, res) => {
  try {
    const { message, sessionId = "anon" } = req.body;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message required" });
    }

    const msg = message.trim();
    console.log(`🤖 [CHATBOT] Session: ${sessionId} | Message: "${msg}"`);

    const { intent, extracted } = detectIntent(msg);
    console.log(`🎯 [CHATBOT] Intent: ${intent}`, extracted);

    const context = getContext(sessionId);
    let response;

    // Context-aware follow-up handling
    if (
      context?.lastIntent === "TRACK_ORDER" &&
      !extracted.orderNumber &&
      !extracted.phone
    ) {
      // User might be providing order number or phone as follow-up
      const orderNumMatch = msg.match(/\b(ORD-\d{6}-\d{5})\b/i);
      const phoneMatch = msg.match(/\b(01[3-9]\d{8})\b/);
      if (orderNumMatch || phoneMatch) {
        response = await buildOrderTrackResponse(extracted, msg);
      }
    }

    if (!response) {
      switch (intent) {
        case "TRACK_ORDER":
          response = await buildOrderTrackResponse(extracted, msg);
          break;
        case "PRODUCT_SEARCH":
          response = await buildProductSearchResponse(msg);
          break;
        case "DELIVERY_INFO":
          response = await buildDeliveryResponse(msg);
          break;
        case "COUPON_INFO":
          response = await buildCouponResponse(msg);
          break;
        case "RETURN_REFUND":
          response = buildReturnResponse();
          break;
        case "PAYMENT_INFO":
          response = buildPaymentResponse();
          break;
        case "CONTACT":
          response = buildContactResponse();
          break;
        case "GREETING":
          response = await buildGreetingResponse();
          break;
        case "THANKS":
          response = {
            type: "thanks",
            text: "😊 আপনাকে স্বাগতম! আর কোনো সাহায্যের প্রয়োজন হলে জানাবেন।",
            suggestions: ["অর্ডার ট্র্যাক করুন", "পণ্য দেখুন"],
          };
          break;
        default:
          response = buildUnknownResponse();
      }
    }

    setContext(sessionId, { lastIntent: intent, lastExtracted: extracted });

    console.log(`✅ [CHATBOT] Response type: ${response.type}`);

    res.json({
      success: true,
      intent,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CHATBOT] Error:", error.message);
    res.status(500).json({
      success: false,
      response: {
        type: "error",
        text: "😔 দুঃখিত, একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
        suggestions: ["পুনরায় চেষ্টা করুন", "সরাসরি যোগাযোগ করুন"],
      },
    });
  }
};

// @desc    Get suggested quick replies
// @route   GET /api/chatbot/suggestions
// @access  Public
const getSuggestions = async (req, res) => {
  try {
    const [productCount, activeOffers] = await Promise.all([
      Product.countDocuments({ isActive: true, stock: { $gt: 0 } }),
      Coupon.countDocuments({
        isActive: true,
        $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
      }),
    ]);

    res.json({
      success: true,
      suggestions: [
        "আমার অর্ডার ট্র্যাক করুন",
        "কী পণ্য আছে?",
        "ডেলিভারি চার্জ কত?",
        ...(activeOffers > 0 ? ["কুপন কোড আছে?"] : []),
        "পেমেন্ট পদ্ধতি কী কী?",
        "রিটার্ন পলিসি কী?",
      ],
      stats: { productCount, activeOffers },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { processMessage, getSuggestions };
