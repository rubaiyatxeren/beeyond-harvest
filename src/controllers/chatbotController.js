const Order = require("../models/Order");
const Product = require("../models/Product");
const DeliveryCharge = require("../models/DeliveryCharge");
const Coupon = require("../models/Coupon");

/* ═══════════════════════════════════════════════════════════════════════════
   BEEHARVEST CHATBOT — ULTRA POWER NLP ENGINE v3.0
   Supports: Bengali · Banglish · English · Mixed · Typos · Slang · Context
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Normalizer ─────────────────────────────────────────────────────────────
// Converts common Banglish/typo variants to canonical forms before matching

const BANGLISH_MAP = {
  // Order variants
  order: ["ordar", "orda", "odar", "odor", "orer", "order", "অর্ডার"],
  track: ["trak", "trck", "track", "ট্র্যাক", "ট্র্যাকিং", "tracking"],
  cancel: ["cancle", "cancal", "cencel", "cancel", "বাতিল", "ক্যান্সেল"],
  buy: ["boi", "bie", "bye", "buy", "কিনতে", "কিনব", "কিনি", "purchase"],
  product: ["prodct", "procut", "prouduct", "product", "পণ্য", "মাল", "item"],
  delivery: ["delivri", "delivry", "dilivery", "delivery", "ডেলিভারি", "শিপিং"],
  charge: ["charg", "charch", "চার্জ", "খরচ", "cost", "fee", "দাম"],
  coupon: ["coupen", "cupon", "kupun", "কুপন", "coupon", "discount code"],
  payment: ["paymet", "paymnt", "পেমেন্ট", "pay", "পরিশোধ", "টাকা দেওয়া"],
  bkash: ["bkas", "bikash", "bkash", "বিকাশ", "b-kash"],
  nagad: ["nagod", "nagad", "নগদ"],
  return: ["retun", "retrn", "রিটার্ন", "ফেরত", "ফেরৎ", "return", "refund"],
  support: ["suport", "saport", "সাপোর্ট", "help", "সাহায্য", "হেল্প"],
  price: ["prise", "prce", "দাম", "মূল্য", "price", "rate", "রেট", "কত"],
  stock: ["stok", "stokt", "স্টক", "available", "আছে", "পাওয়া যায়"],
};

const normalize = (text) => {
  let t = text.toLowerCase().trim();
  // Remove extra spaces
  t = t.replace(/\s+/g, " ");
  // Common letter swaps for Banglish typos
  t = t.replace(/ph/g, "f").replace(/kh/g, "k");
  return t;
};

// Checks if text contains any of the given keywords (with fuzzy tolerance)
const hasAny = (text, keywords) => {
  const t = normalize(text);
  return keywords.some((kw) => {
    const k = normalize(kw);
    if (t.includes(k)) return true;
    // Levenshtein distance ≤ 1 for short words, ≤ 2 for longer
    if (k.length >= 4) {
      const words = t.split(/\s+/);
      return words.some((w) => levenshtein(w, k) <= (k.length >= 7 ? 2 : 1));
    }
    return false;
  });
};

// Lightweight Levenshtein for typo tolerance
const levenshtein = (a, b) => {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
};

// ─── Master Intent Definitions ────────────────────────────────────────────────
// Each intent has: hard patterns (regex), keyword groups, and a score threshold

const INTENT_DEFINITIONS = [
  // ── GREETING ──────────────────────────────────────────────────────────────
  {
    name: "GREETING",
    score: 0,
    patterns: [
      /^(hi|hello|hey|helo|hii|hiii|হ্যালো|হেলো|হাই|হাও|সালাম|আস্সালামু|আলাইকুম|নমস্কার|assalamu|wa alaikum|good\s*(morning|evening|afternoon|night)|শুভ\s*(সকাল|সন্ধ্যা|রাত|বিকাল)|কেমন আছ|কেমন আছেন|ki korcho|ki korcho|whats up|what's up|sup|yo\b)[\s!?।]*$/i,
    ],
    keywords: [],
  },

  // ── THANKS ────────────────────────────────────────────────────────────────
  {
    name: "THANKS",
    score: 0,
    patterns: [
      /^(thanks?|thank you|ধন্যবাদ|শুকরিয়া|জাজাকাল্লাহ|অসংখ্য ধন্যবাদ|tnx|thnx|thx|ty\b|জাজাক)[\s!।]*$/i,
    ],
    keywords: [],
  },

  // ── TRACK ORDER ──────────────────────────────────────────────────────────
  {
    name: "TRACK_ORDER",
    score: 0,
    patterns: [
      /\b(ORD-\d{4,6}-\d{4,6})\b/i,
      /অর্ডার.{0,20}(ট্র্যাক|খুঁজ|কোথায়|status|স্ট্যাটাস|দেখ)/i,
      /track.{0,15}order/i,
      /order.{0,15}(status|track|where|koi|কোথায়|কি হলো|কি হয়েছে)/i,
      /আমার.{0,10}(অর্ডার|order).{0,15}(কোথায়|কি|দেখ|জান)/i,
      /order\s*number/i,
      /আমার অর্ডার/i,
    ],
    keywordGroups: [
      // Must have at least one from each filled group
      {
        any: [
          "track",
          "trak",
          "ট্র্যাক",
          "tracking",
          "status",
          "স্ট্যাটাস",
          "koi hai",
          "kothay",
          "কোথায়",
          "কি হলো",
          "জানতে চাই",
          "update",
          "আপডেট",
          "কি অবস্থা",
          "ki obostha",
          "dibo kobe",
          "কবে পাব",
          "pabo kobe",
          "reach",
          "পৌঁছাবে",
          "pochabe",
          "delivered",
          "shiped",
          "shipped",
          "transit",
          "on the way",
        ],
      },
      {
        any: [
          "order",
          "ordar",
          "অর্ডার",
          "পার্সেল",
          "parcel",
          "package",
          "delivery",
          "ডেলিভারি",
        ],
      },
    ],
    phonePattern: /\b(01[3-9]\d{8})\b/,
    orderPattern: /\b(ORD-\d{4,6}-\d{4,6})\b/i,
  },

  // ── HOW TO ORDER / PLACE ORDER ────────────────────────────────────────────
  {
    name: "HOW_TO_ORDER",
    score: 0,
    patterns: [
      /কিভাবে.{0,20}(অর্ডার|order|কিনব|buy|purchase)/i,
      /how.{0,15}(to|do|can).{0,15}(order|buy|purchase|kinte|কিনব)/i,
      /অর্ডার.{0,20}(করব|করতে|করি|দিতে|দিব|দিতে পারি|করার নিয়ম|process)/i,
      /order.{0,20}(korbo|korte|kori|dite|dibo|process|procedure|korar niyom)/i,
      /(কিনতে|kinte|buy|purchase).{0,20}(চাই|chai|want|want to|চাইলে|korbo|করব)/i,
      /অর্ডার\s*(করতে চাই|দিতে চাই|করব|দেব|দিব|করা যাবে|করব কিভাবে)/i,
      /order\s*(korte chai|dite chai|korbo|debo|dibo|kora jabe)/i,
      /(order|অর্ডার)\s*(ki vabe|kemon vabe|kevabe)/i,
      /কেনাকাটা.{0,15}(করব|করতে|করি|শুরু)/i,
      /shopping.{0,15}(korbo|korte|shuru)/i,
      /পণ্য.{0,20}(অর্ডার|কিনব|নেব)/i,
    ],
    keywordGroups: [
      {
        any: [
          "order korte chai",
          "order dite chai",
          "kinte chai",
          "kinbo",
          "buy korbo",
          "purchase korbo",
          "অর্ডার করতে চাই",
          "কিনতে চাই",
          "কিনব",
          "নেব",
          "নিতে চাই",
          "order korbo",
          "order dibo",
          "order korte pari",
          "order nite chai",
          "shopping korbo",
          "কেনাকাটা করব",
          "পণ্য নেব",
          "মাল নেব",
        ],
      },
    ],
  },

  // ── PRODUCT SEARCH ────────────────────────────────────────────────────────
  {
    name: "PRODUCT_SEARCH",
    score: 0,
    patterns: [
      /পণ্য.{0,20}(আছে|পাওয়া|stock|স্টক|দেখ|list|available)/i,
      /product.{0,20}(available|stock|আছে|কি কি|কোনগুলো|list)/i,
      /কি\s*পণ্য/i,
      /কোন.{0,10}(পণ্য|product|item)/i,
      /মধু.{0,10}(আছে|দাম|price|কত)/i,
      /দাম.{0,20}(কত|জানত|বলুন|টাকা)/i,
      /price.{0,20}(of|কত|tell|bolo)/i,
      /(কত\s*টাকা|how much|koto taka)/i,
      /stock.{0,15}(আছে|e ache|available)/i,
    ],
    keywordGroups: [
      {
        any: [
          "price",
          "দাম",
          "মূল্য",
          "koto",
          "কত",
          "taka",
          "টাকা",
          "available",
          "আছে",
          "stock",
          "স্টক",
          "product",
          "পণ্য",
          "item",
          "মাল",
          "কি আছে",
          "ki ache",
          "list",
          "catalog",
          "ki ki ache",
          "কি কি আছে",
          "show",
          "দেখ",
          "দেখান",
        ],
      },
    ],
  },

  // ── DELIVERY INFO ─────────────────────────────────────────────────────────
  {
    name: "DELIVERY_INFO",
    score: 0,
    patterns: [
      /ডেলিভারি.{0,20}(চার্জ|খরচ|সময়|কত|কবে|কতদিন|কতক্ষণ)/i,
      /delivery.{0,20}(charge|cost|time|fee|how long|koto din|কত দিন)/i,
      /শিপিং.{0,15}(চার্জ|cost|কত)/i,
      /shipping.{0,15}(charge|cost|কত|fee)/i,
      /কতদিনে.{0,10}(পাব|পৌঁছাবে|আসবে|deliver)/i,
      /how\s*long.{0,20}(delivery|ship|take|আসতে)/i,
      /deliver.{0,10}(hobe|hobo|korbe|time|koto din)/i,
      /free\s*delivery/i,
      /ফ্রি\s*ডেলিভারি/i,
      /ঢাকা.{0,10}(ডেলিভারি|charge|চার্জ)/i,
    ],
    keywordGroups: [
      {
        any: [
          "delivery",
          "ডেলিভারি",
          "shipping",
          "শিপিং",
          "courier",
          "কুরিয়ার",
          "charge",
          "চার্জ",
          "fee",
          "cost",
          "খরচ",
          "koto din",
          "কতদিন",
          "kobe pabo",
          "কবে পাব",
          "kobe asbe",
          "কবে আসবে",
          "how long",
          "সময়",
          "time",
          "deliver hobe",
          "ডেলিভারি হবে",
        ],
      },
    ],
  },

  // ── COUPON / DISCOUNT ─────────────────────────────────────────────────────
  {
    name: "COUPON_INFO",
    score: 0,
    patterns: [
      /কুপন.{0,20}(আছে|পাওয়া|দেন|বলুন|কোড|code|use)/i,
      /coupon.{0,20}(available|আছে|code|use|apply)/i,
      /discount.{0,20}(আছে|পাওয়া|code|code|কত)/i,
      /ছাড়.{0,15}(পাব|আছে|পাওয়া|কত)/i,
      /offer.{0,15}(আছে|কি|কি কি|available)/i,
      /অফার.{0,15}(আছে|কি|কি কি)/i,
      /promo.{0,10}(code|কোড)/i,
      /voucher/i,
    ],
    keywordGroups: [
      {
        any: [
          "coupon",
          "কুপন",
          "discount",
          "ছাড়",
          "offer",
          "অফার",
          "promo",
          "voucher",
          "code",
          "কোড",
          "rebate",
          "cashback",
          "কমিশন",
          "সেল",
          "sale",
          "deal",
          "কম দামে",
          "কম দাম",
        ],
      },
    ],
    codePattern: /\b([A-Z][A-Z0-9]{3,19})\b/,
  },

  // ── RETURN / REFUND / CANCEL ──────────────────────────────────────────────
  {
    name: "RETURN_REFUND",
    score: 0,
    patterns: [
      /রিটার্ন.{0,20}(করব|করতে|পলিসি|নিয়ম|কিভাবে)/i,
      /return.{0,20}(policy|korbo|korte|kemon|নিয়ম|পলিসি)/i,
      /রিফান্ড.{0,15}(পাব|পাওয়া|কিভাবে|পলিসি)/i,
      /refund.{0,15}(pabo|korbo|policy|kemon)/i,
      /পণ্য.{0,15}(ফেরত|ফেরৎ|বদলে|exchange)/i,
      /cancel.{0,15}(order|অর্ডার|করব|debo)/i,
      /বাতিল.{0,15}(করব|করতে|করা যাবে)/i,
      /ক্ষতিগ্রস্ত.{0,15}পণ্য/i,
      /damaged.{0,15}product/i,
      /wrong.{0,15}(product|item|পণ্য)/i,
      /ভুল.{0,15}পণ্য/i,
    ],
    keywordGroups: [
      {
        any: [
          "return",
          "রিটার্ন",
          "refund",
          "রিফান্ড",
          "exchange",
          "ফেরত",
          "cancel",
          "বাতিল",
          "ক্যান্সেল",
          "cancle",
          "damaged",
          "ক্ষতিগ্রস্ত",
          "wrong product",
          "ভুল পণ্য",
          "money back",
          "টাকা ফেরত",
          "taka ferot",
          "taka ফেরত",
        ],
      },
    ],
  },

  // ── PAYMENT INFO ──────────────────────────────────────────────────────────
  {
    name: "PAYMENT_INFO",
    score: 0,
    patterns: [
      /পেমেন্ট.{0,20}(পদ্ধতি|method|কিভাবে|করব|option)/i,
      /payment.{0,20}(method|option|কিভাবে|korbo|কি কি)/i,
      /কিভাবে.{0,15}(পেমেন্ট|pay|টাকা দেব)/i,
      /bkash.{0,15}(e dite|দিতে|pay|payment)/i,
      /nagad.{0,15}(e dite|দিতে|pay|payment)/i,
      /(cash|নগদ).{0,10}(on delivery|অন ডেলিভারি|COD)/i,
      /কিভাবে.{0,15}(টাকা|taka|pay|পরিশোধ)/i,
      /টাকা.{0,15}(দেব|দিব|pay|পরিশোধ)/i,
      /card.{0,10}(payment|pay|দিতে)/i,
    ],
    keywordGroups: [
      {
        any: [
          "payment",
          "পেমেন্ট",
          "pay",
          "bkash",
          "বিকাশ",
          "nagad",
          "নগদ",
          "rocket",
          "রকেট",
          "card",
          "কার্ড",
          "cash on delivery",
          "COD",
          "cod",
          "online payment",
          "mobile banking",
          "কিভাবে টাকা",
          "taka dibo",
          "টাকা দেব",
          "কিভাবে দেব",
        ],
      },
    ],
  },

  // ── CONTACT / SUPPORT ─────────────────────────────────────────────────────
  {
    name: "CONTACT",
    score: 0,
    patterns: [
      /যোগাযোগ.{0,15}(করব|করতে|নম্বর|করার)/i,
      /contact.{0,15}(number|us|করব|info|করতে)/i,
      /ফোন.{0,10}(নম্বর|number|দেন)/i,
      /phone.{0,10}(number|নম্বর|কত)/i,
      /whatsapp.{0,10}(number|নম্বর|করব)/i,
      /কথা.{0,10}(বলব|বলতে|মানুষ|agent|human)/i,
      /human.{0,10}(agent|support|help)/i,
      /real.{0,10}(person|human|agent)/i,
      /সাপোর্ট.{0,10}(নম্বর|টিম|পাব)/i,
      /customer.{0,10}(care|service|support)/i,
      /complain/i,
      /অভিযোগ/i,
      /email.{0,10}(address|দেন|কি)/i,
    ],
    keywordGroups: [
      {
        any: [
          "contact",
          "যোগাযোগ",
          "phone",
          "ফোন",
          "call",
          "কল",
          "whatsapp",
          "email",
          "ইমেইল",
          "support",
          "সাপোর্ট",
          "helpline",
          "customer care",
          "কাস্টমার কেয়ার",
          "agent",
          "human",
          "মানুষ",
          "কথা বলব",
          "kotha bolbo",
          "complain",
          "অভিযোগ",
          "help",
          "সাহায্য",
        ],
      },
    ],
  },
];

// ─── Scoring Engine ───────────────────────────────────────────────────────────

const detectIntent = (message) => {
  const raw = message.trim();
  const msg = normalize(raw);

  // Extract entities first (order number, phone)
  const orderNumberMatch = raw.match(/\b(ORD-\d{4,6}-\d{4,6})\b/i);
  const phoneMatch = raw.match(/\b(01[3-9]\d{8})\b/);
  const couponCodeMatch = raw.match(/\b([A-Z][A-Z0-9]{3,19})\b/);

  const extracted = {
    orderNumber: orderNumberMatch ? orderNumberMatch[1].toUpperCase() : null,
    phone: phoneMatch ? phoneMatch[1] : null,
    couponCode: couponCodeMatch ? couponCodeMatch[1] : null,
  };

  // If raw order number present → definitely TRACK_ORDER
  if (extracted.orderNumber) {
    return { intent: "TRACK_ORDER", extracted };
  }

  // Score each intent
  const scores = {};

  for (const def of INTENT_DEFINITIONS) {
    let score = 0;

    // Hard pattern match (highest weight)
    for (const pattern of def.patterns || []) {
      if (pattern.test(raw) || pattern.test(msg)) {
        score += 10;
        break;
      }
    }

    // Keyword group matching
    for (const group of def.keywordGroups || []) {
      if (group.any && hasAny(raw, group.any)) {
        score += 5;
      }
      if (group.all && group.all.every((kw) => hasAny(raw, [kw]))) {
        score += 8;
      }
    }

    scores[def.name] = score;
  }

  // Find best intent
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (best && best[1] > 0) {
    return { intent: best[0], extracted, scores };
  }

  // ── Fallback heuristics for short / vague messages ─────────────────────
  const words = msg.split(/\s+/);

  if (words.length <= 3) {
    // Very short — try substring matching with flattened aliases
    const flatMap = {
      TRACK_ORDER: [
        "track",
        "ট্র্যাক",
        "tracking",
        "status",
        "কোথায়",
        "order status",
      ],
      HOW_TO_ORDER: [
        "order korte",
        "kinte",
        "buy",
        "kinbo",
        "কিনব",
        "order dite",
      ],
      DELIVERY_INFO: [
        "delivery",
        "ডেলিভারি",
        "shipping",
        "কতদিন",
        "charge",
        "চার্জ",
      ],
      COUPON_INFO: ["coupon", "কুপন", "discount", "ছাড়", "offer", "অফার"],
      PAYMENT_INFO: ["payment", "পেমেন্ট", "bkash", "nagad", "pay"],
      RETURN_REFUND: ["return", "রিটার্ন", "refund", "cancel", "বাতিল"],
      CONTACT: ["contact", "যোগাযোগ", "phone", "ফোন", "help", "সাহায্য"],
      PRODUCT_SEARCH: [
        "product",
        "পণ্য",
        "price",
        "দাম",
        "stock",
        "আছে",
        "কি আছে",
      ],
      GREETING: ["hi", "hello", "hey", "সালাম", "হ্যালো"],
      THANKS: ["thanks", "ধন্যবাদ", "thank"],
    };

    for (const [intent, keys] of Object.entries(flatMap)) {
      if (hasAny(raw, keys)) {
        return { intent, extracted };
      }
    }
  }

  return { intent: "UNKNOWN", extracted };
};

// ─── Context Memory (session-based, 30-min TTL) ───────────────────────────────

const sessionContext = new Map();

const getContext = (sessionId) => {
  const ctx = sessionContext.get(sessionId);
  if (ctx && Date.now() - ctx.timestamp < 30 * 60 * 1000) return ctx;
  sessionContext.delete(sessionId);
  return null;
};

const setContext = (sessionId, data) => {
  sessionContext.set(sessionId, { ...data, timestamp: Date.now() });
  if (sessionContext.size > 2000) {
    const oldest = [...sessionContext.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    )[0];
    sessionContext.delete(oldest[0]);
  }
};

// ─── Response Builders ────────────────────────────────────────────────────────

const buildOrderTrackResponse = async (extracted, message) => {
  const { orderNumber, phone } = extracted;

  if (orderNumber) {
    const order = await Order.findOne({
      orderNumber: { $regex: orderNumber, $options: "i" },
    }).select(
      "orderNumber orderStatus paymentStatus customer.name items.name deliveryCharge total trackingNumber createdAt deliveryPartner",
    );

    if (!order) {
      return {
        text: `❌ **${orderNumber}** নম্বরের কোনো অর্ডার পাওয়া যায়নি।\n\nঅর্ডার নম্বরটি সঠিক কিনা যাচাই করুন। উদাহরণ: **ORD-202504-12345**`,
        suggestions: [
          "ফোন নম্বর দিয়ে খুঁজুন",
          "সাপোর্টে যোগাযোগ করুন",
          "নতুন অর্ডার করুন",
        ],
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
      text: `🔍 **অর্ডার পাওয়া গেছে!**`,
      order: {
        number: order.orderNumber,
        status: order.orderStatus,
        statusBn: statusBn[order.orderStatus] || order.orderStatus,
        statusEmoji: statusEmoji[order.orderStatus] || "📦",
        paymentStatus: order.paymentStatus,
        customerName: order.customer?.name,
        trackingNumber: order.trackingNumber,
        deliveryPartner: order.deliveryPartner,
        total: order.total,
        date: order.createdAt,
      },
      suggestions: [
        "আরেকটি অর্ডার ট্র্যাক করুন",
        "ডেলিভারি চার্জ কত?",
        "সাপোর্টে কথা বলুন",
      ],
    };
  }

  if (phone) {
    const orders = await Order.find({ "customer.phone": phone })
      .select("orderNumber orderStatus total createdAt")
      .sort("-createdAt")
      .limit(5);

    if (!orders.length) {
      return {
        text: `❌ **${phone}** নম্বরে কোনো অর্ডার পাওয়া যায়নি।\n\nঅন্য নম্বর দিয়ে চেষ্টা করুন অথবা সরাসরি সাপোর্টে যোগাযোগ করুন।`,
        suggestions: ["সাপোর্টে যোগাযোগ করুন", "নতুন অর্ডার করুন"],
      };
    }

    return {
      text: `📋 **${phone}** নম্বরে **${orders.length}টি** অর্ডার পাওয়া গেছে:`,
      orders: orders.map((o) => ({
        number: o.orderNumber,
        status: o.orderStatus,
        total: o.total,
        date: o.createdAt,
      })),
      suggestions: ["নির্দিষ্ট অর্ডার নম্বর দিন", "ডেলিভারি চার্জ কত?"],
    };
  }

  return {
    text: `🔍 আপনার অর্ডার ট্র্যাক করতে নিচের যেকোনো একটি দিন:\n\n📦 **অর্ডার নম্বর** — যেমন: ORD-202504-12345\n📞 **ফোন নম্বর** — যেমন: 01700000000`,
    suggestions: ["ORD-XXXXXX-XXXXX লিখুন", "01XXXXXXXXX লিখুন"],
  };
};

const buildHowToOrderResponse = () => ({
  text: `🛒 **অর্ডার করার সহজ ধাপ:**\n\n**১.** পণ্য বেছে নিন → **কার্টে যোগ করুন**\n**২.** কার্ট আইকনে ক্লিক করুন → **অর্ডার করুন**\n**৩.** আপনার নাম, ফোন ও ঠিকানা দিন\n**৪.** পেমেন্ট পদ্ধতি বেছে নিন\n**৫.** **অর্ডার কনফার্ম করুন** — শেষ! 🎉\n\n💡 অর্ডার করার পর SMS/Email-এ কনফার্মেশন পাবেন।`,
  suggestions: [
    "ডেলিভারি চার্জ কত?",
    "পেমেন্ট পদ্ধতি কী কী?",
    "কুপন কোড আছে?",
    "পণ্য দেখুন",
  ],
});

const buildProductSearchResponse = async (message) => {
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
    "আছেন",
    "বলুন",
    "tell",
    "show",
    "ki",
    "ki",
    "কি",
    "আমাকে",
  ];

  const words = message
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !stopWords.some((sw) => normalize(w).includes(normalize(sw))),
    );

  let products = [];

  if (words.length > 0) {
    products = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: words.join("|"), $options: "i" } },
        { nameBn: { $regex: words.join("|"), $options: "i" } },
        { tags: { $in: words.map((w) => new RegExp(w, "i")) } },
        { description: { $regex: words.join("|"), $options: "i" } },
      ],
    })
      .select("name nameBn price comparePrice stock")
      .limit(5)
      .lean();
  }

  if (!products.length) {
    products = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .select("name nameBn price comparePrice stock")
      .sort("-isFeatured -createdAt")
      .limit(6)
      .lean();

    return {
      text: `🛒 এখন **স্টকে আছে** এমন কিছু পণ্য:`,
      products: products.map((p) => ({
        name: p.nameBn || p.name,
        price: p.price,
        comparePrice: p.comparePrice,
        stock: p.stock,
        inStock: p.stock > 0,
      })),
      suggestions: ["অর্ডার করতে চাই", "ডেলিভারি চার্জ কত?", "কুপন আছে?"],
    };
  }

  return {
    text: `🛍️ **${products.length}টি** পণ্য পাওয়া গেছে:`,
    products: products.map((p) => ({
      name: p.nameBn || p.name,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock,
      inStock: p.stock > 0,
    })),
    suggestions: ["অর্ডার করতে চাই", "ডেলিভারি চার্জ কত?", "আরও পণ্য দেখুন"],
  };
};

const buildDeliveryResponse = async () => {
  try {
    const charges = await DeliveryCharge.find({ isActive: true }).lean();
    const inside = charges.find((c) => c.name === "inside_dhaka");
    const outside = charges.find((c) => c.name === "outside_dhaka");
    const special = charges.find((c) => c.name === "default");

    return {
      text: `🚚 **ডেলিভারি তথ্য:**`,
      charges: {
        insideDhaka: inside?.amount ?? 60,
        outsideDhaka: outside?.amount ?? 120,
        special: special
          ? { amount: special.amount, minOrder: special.minOrderAmount }
          : null,
      },
      deliveryTime: {
        insideDhaka: "১–২ কার্যদিবস",
        outsideDhaka: "২–৫ কার্যদিবস",
      },
      suggestions: [
        "কুপন কোড আছে?",
        "পেমেন্ট পদ্ধতি কী কী?",
        "অর্ডার করতে চাই",
      ],
    };
  } catch {
    return {
      text: `🚚 **ডেলিভারি চার্জ:**\n\n🏙️ ঢাকার ভেতরে: **৳৬০** (১–২ দিন)\n🚚 ঢাকার বাইরে: **৳১২০** (২–৫ দিন)`,
      suggestions: ["অর্ডার করতে চাই", "কুপন আছে?"],
    };
  }
};

const buildCouponResponse = async (message) => {
  // Detect if a specific code was mentioned (all caps, 4-20 chars)
  const codeMatch = message.match(/\b([A-Z][A-Z0-9]{3,19})\b/);
  const skipWords = new Set([
    "ORDER",
    "TRACK",
    "INFO",
    "HELP",
    "WHAT",
    "WHEN",
    "WHERE",
    "HOW",
    "WHY",
    "ORD",
    "SMS",
    "OTP",
    "PIN",
    "FAQ",
  ]);
  const now = new Date();

  if (codeMatch && !skipWords.has(codeMatch[1])) {
    const coupon = await Coupon.findOne({
      code: codeMatch[1].toUpperCase(),
      isActive: true,
    }).lean();

    if (coupon) {
      const expired = coupon.endDate && now > new Date(coupon.endDate);
      const exhausted =
        coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
      const valid = !expired && !exhausted;

      return {
        text: valid
          ? `✅ **${coupon.code}** কুপন বৈধ এবং ব্যবহারযোগ্য!`
          : `❌ **${coupon.code}** কুপনটি ${expired ? "মেয়াদ উত্তীর্ণ" : "শেষ হয়ে গেছে"}।`,
        coupon: {
          code: coupon.code,
          type: coupon.discountType,
          value: coupon.discountValue,
          minOrder: coupon.minimumOrder,
          maxDiscount: coupon.maximumDiscount,
          valid,
        },
        suggestions: ["অর্ডার করতে চাই", "ডেলিভারি চার্জ কত?"],
      };
    }

    return {
      text: `❌ **${codeMatch[1]}** কোডের কোনো কুপন পাওয়া যায়নি।`,
      suggestions: ["সক্রিয় কুপন দেখুন", "ডেলিভারি চার্জ কত?"],
    };
  }

  // FIXED: Return ONLY truly active coupons (not expired, not exhausted)
  const activeCoupons = await Coupon.find({
    isActive: true,
    $and: [
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      {
        $or: [
          { usageLimit: { $exists: false } },
          { usageLimit: null },
          { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
        ],
      },
    ],
  })
    .select(
      "code discountType discountValue minimumOrder description usedCount usageLimit endDate",
    )
    .limit(5)
    .lean();

  // Double-check manually (safety filter)
  const validCoupons = activeCoupons.filter((c) => {
    const expired = c.endDate && now > new Date(c.endDate);
    const exhausted = c.usageLimit && c.usedCount >= c.usageLimit;
    return !expired && !exhausted;
  });

  if (!validCoupons.length) {
    return {
      text: `😔 এই মুহূর্তে কোনো সক্রিয় কুপন কোড নেই।\n\n💡 আমাদের Facebook পেজ ফলো করুন — নিয়মিত অফার আসে!`,
      suggestions: ["ডেলিভারি চার্জ কত?", "অর্ডার করতে চাই", "যোগাযোগ করুন"],
    };
  }

  return {
    text: `🎟️ **${validCoupons.length}টি** সক্রিয় কুপন পাওয়া গেছে! চেকআউটে ব্যবহার করুন:`,
    coupons: validCoupons.map((c) => ({
      code: c.code,
      type: c.discountType,
      value: c.discountValue,
      minOrder: c.minimumOrder,
      description: c.description,
    })),
    suggestions: ["অর্ডার করতে চাই", "কুপন কোড যাচাই করুন"],
  };
};

const buildReturnResponse = () => ({
  text: `↩️ **রিটার্ন ও রিফান্ড নীতি:**`,
  points: [
    "✅ পণ্য পাওয়ার **৭ দিনের** মধ্যে রিটার্ন করা যাবে",
    "✅ পণ্য অক্ষত ও মূল প্যাকেজিংসহ থাকতে হবে",
    "✅ ভুল/ক্ষতিগ্রস্ত পণ্য পেলে ৪৮ ঘণ্টার মধ্যে জানাতে হবে",
    "✅ রিফান্ড ৩–৫ কার্যদিবসের মধ্যে প্রদান করা হবে",
    "❌ ব্যবহৃত বা ক্ষতিগ্রস্ত পণ্য রিটার্ন গ্রহণযোগ্য নয়",
    "❌ অর্ডার শিপ হওয়ার পরে বাতিল করা যাবে না",
  ],
  suggestions: ["যোগাযোগ করুন", "অর্ডার ট্র্যাক করুন", "অর্ডার করতে চাই"],
});

const buildPaymentResponse = () => ({
  text: `💳 **পেমেন্ট পদ্ধতিসমূহ:**`,
  methods: [
    { name: "💵 ক্যাশ অন ডেলিভারি", desc: "পণ্য পাওয়ার পর নগদ পেমেন্ট" },
    { name: "📱 বিকাশ (bKash)", desc: "মোবাইল ব্যাংকিং" },
    { name: "📱 নগদ (Nagad)", desc: "মোবাইল ব্যাংকিং" },
    { name: "📱 রকেট (Rocket)", desc: "মোবাইল ব্যাংকিং" },
    { name: "💳 ডেবিট/ক্রেডিট কার্ড", desc: "সকল ব্যাংক কার্ড" },
  ],
  suggestions: ["ডেলিভারি চার্জ কত?", "কুপন কোড আছে?", "অর্ডার করতে চাই"],
});

const buildContactResponse = () => ({
  text: `📞 **আমাদের সাথে যোগাযোগ করুন:**`,
  channels: [
    { icon: "📞", label: "হটলাইন", value: "01700-000000" },
    { icon: "💬", label: "WhatsApp", value: "01700-000001" },
    { icon: "📧", label: "ইমেইল", value: "support@beeharvest.com.bd" },
    { icon: "👥", label: "Facebook", value: "facebook.com/beeharvest" },
  ],
  hours: "সকাল ৯টা – রাত ১০টা (প্রতিদিন)",
  suggestions: ["অর্ডার ট্র্যাক করুন", "রিটার্ন নীতি জানুন", "ডেলিভারি তথ্য"],
});

const buildGreetingResponse = async () => {
  let productCount = 0;
  try {
    productCount = await Product.countDocuments({
      isActive: true,
      stock: { $gt: 0 },
    });
  } catch {}

  return {
    text: `🐝 **আস্সালামু আলাইকুম! BeeHarvest-এ স্বাগতম!** 🎉\n\nআমি আপনার AI সহকারী — অর্ডার ট্র্যাকিং, পণ্যের দাম, ডেলিভারি, কুপন — সব বিষয়ে সাহায্য করতে পারি।`,
    stats: { productCount },
    suggestions: [
      "আমার অর্ডার ট্র্যাক করুন",
      "কী পণ্য আছে?",
      "অর্ডার করতে চাই",
      "ডেলিভারি চার্জ কত?",
    ],
  };
};

const buildThanksResponse = () => ({
  text: `😊 আপনাকে ধন্যবাদ! আর কোনো সাহায্যের প্রয়োজন হলে যেকোনো সময় জিজ্ঞেস করুন। 🐝`,
  suggestions: ["অর্ডার ট্র্যাক করুন", "পণ্য দেখুন", "ডেলিভারি তথ্য"],
});

const buildUnknownResponse = (message) => {
  // Try to give a useful hint based on message content
  const msg = normalize(message);
  let hint = "";

  if (msg.length < 5) {
    hint = "আপনার প্রশ্নটি একটু বিস্তারিত লিখলে ভালো সাহায্য করতে পারব। 😊";
  } else if (
    hasAny(message, ["মধু", "honey", "ghee", "ঘি", "zira", "জিরা", "চা", "tea"])
  ) {
    hint = "পণ্যটির দাম বা স্টক জানতে নিচের বাটনে ক্লিক করুন।";
  }

  return {
    text: `🤔 "${message.substring(0, 50)}" — এই বিষয়ে আমি নিশ্চিত নই।${hint ? `\n\n💡 ${hint}` : ""}\n\nআমি এই বিষয়গুলোতে সাহায্য করতে পারি:`,
    topics: [
      "📦 অর্ডার ট্র্যাকিং (অর্ডার নম্বর বা ফোন নম্বর দিয়ে)",
      "🛒 অর্ডার করার পদ্ধতি",
      "🛍️ পণ্যের তথ্য ও দাম",
      "🚚 ডেলিভারি চার্জ ও সময়",
      "🎟️ কুপন কোড ও অফার",
      "↩️ রিটার্ন ও রিফান্ড নীতি",
      "💳 পেমেন্ট পদ্ধতি",
      "📞 যোগাযোগের তথ্য",
    ],
    suggestions: [
      "অর্ডার করতে চাই",
      "অর্ডার ট্র্যাক করুন",
      "ডেলিভারি চার্জ কত?",
      "যোগাযোগ করুন",
    ],
  };
};

// ─── Context-Aware Follow-up Handler ─────────────────────────────────────────

const handleContextFollowup = async (context, message, extracted) => {
  const { lastIntent } = context;
  const msg = normalize(message);

  // If last intent was TRACK_ORDER and now user provides order# or phone
  if (
    lastIntent === "TRACK_ORDER" &&
    (extracted.orderNumber || extracted.phone)
  ) {
    return await buildOrderTrackResponse(extracted, message);
  }

  // If last intent was HOW_TO_ORDER and user says "ok", "accha", "bujhchi", "got it"
  if (
    lastIntent === "HOW_TO_ORDER" &&
    hasAny(message, [
      "ok",
      "okay",
      "accha",
      "আচ্ছা",
      "bujhchi",
      "বুঝলাম",
      "got it",
      "thik ache",
      "ঠিক আছে",
      "done",
      "thank",
    ])
  ) {
    return {
      text: `👍 চমৎকার! এখনই কেনাকাটা শুরু করুন। কোনো সমস্যা হলে আমাকে জিজ্ঞেস করুন!`,
      suggestions: ["পণ্য দেখুন", "ডেলিভারি চার্জ কত?", "কুপন আছে?"],
    };
  }

  // If last intent was COUPON_INFO and user provides a code
  if (lastIntent === "COUPON_INFO" && extracted.couponCode) {
    return await buildCouponResponse(message);
  }

  return null; // No context match
};

// ─── Main Controller ──────────────────────────────────────────────────────────

// @desc    Process chatbot message
// @route   POST /api/chatbot/message
// @access  Public
const processMessage = async (req, res) => {
  try {
    const { message, sessionId = "anon" } = req.body;

    if (!message?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message required" });
    }

    const raw = message.trim();
    console.log(`🤖 [CHATBOT] Session: ${sessionId} | Message: "${raw}"`);

    const { intent, extracted } = detectIntent(raw);
    console.log(`🎯 [CHATBOT] Intent: ${intent}`, extracted);

    const context = getContext(sessionId);
    let response = null;

    // ── Try context-aware followup first ────────────────────────────────────
    if (context) {
      response = await handleContextFollowup(context, raw, extracted);
    }

    // ── Main intent dispatch ─────────────────────────────────────────────────
    if (!response) {
      switch (intent) {
        case "TRACK_ORDER":
          response = await buildOrderTrackResponse(extracted, raw);
          break;
        case "HOW_TO_ORDER":
          response = buildHowToOrderResponse();
          break;
        case "PRODUCT_SEARCH":
          response = await buildProductSearchResponse(raw);
          break;
        case "DELIVERY_INFO":
          response = await buildDeliveryResponse();
          break;
        case "COUPON_INFO":
          response = await buildCouponResponse(raw.toUpperCase());
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
          response = buildThanksResponse();
          break;
        default:
          response = buildUnknownResponse(raw);
      }
    }

    // Save context
    setContext(sessionId, {
      lastIntent: intent,
      lastExtracted: extracted,
      lastMessage: raw,
    });

    console.log(`✅ [CHATBOT] Responding with intent: ${intent}`);

    return res.json({
      success: true,
      intent,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CHATBOT] Error:", error.message);
    return res.status(500).json({
      success: false,
      response: {
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

    const suggestions = [
      "আমার অর্ডার ট্র্যাক করুন",
      "অর্ডার করতে চাই",
      "কী পণ্য আছে?",
      "ডেলিভারি চার্জ কত?",
      ...(activeOffers > 0 ? [`${activeOffers}টি কুপন আছে!`] : []),
      "পেমেন্ট পদ্ধতি কী কী?",
      "রিটার্ন পলিসি কী?",
    ];

    return res.json({
      success: true,
      suggestions,
      stats: { productCount, activeOffers },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { processMessage, getSuggestions };
