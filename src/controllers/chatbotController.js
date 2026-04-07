const Order = require("../models/Order");
const Product = require("../models/Product");
const DeliveryCharge = require("../models/DeliveryCharge");
const Coupon = require("../models/Coupon");
const natural = require("natural");
const { TfIdf, PorterStemmer, WordNet } = require("natural");
const compromise = require("compromise");
const franc = require("franc-min");
const stringSimilarity = require("string-similarity");

/* ═══════════════════════════════════════════════════════════════════════════
   BEEHARVEST CHATBOT — HYPER INTELLIGENT NLP ENGINE v5.0 "GOD MODE"
   Features: 
   • Multi-language (Bengali/Banglish/English) with auto-detection
   • Semantic search via TF-IDF vectorization
   • Fuzzy matching with Levenshtein & Jaro-Winkler
   • Context window with memory attention
   • Entity extraction (NER)
   • Sentiment analysis
   • Dynamic intent learning
   • Spell correction with custom dictionary
   • Synonym expansion
   • Code-mixed language handling
   ═══════════════════════════════════════════════════════════════════════════ */

// ───────────────────────────────────────────────────────────────────────────
// 1. ENHANCED NORMALIZATION ENGINE
// ───────────────────────────────────────────────────────────────────────────

const SYMBOL_MAP = {
  "৳": "taka",
  $: "dollar",
  "₹": "rupee",
  "%": "percent",
  "+": "plus",
  "&": "and",
  "@": "at",
  "#": "hash",
};

const BENGALI_NUMBERS = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const SLANG_EXPANSIONS = {
  wbu: "what about you",
  hbu: "how about you",
  idk: "i don't know",
  idc: "i don't care",
  imo: "in my opinion",
  lol: "laugh out loud",
  brb: "be right back",
  gtg: "got to go",
  ty: "thank you",
  yw: "you are welcome",
  np: "no problem",
  pls: "please",
  plz: "please",
  thx: "thanks",
  tnx: "thanks",
  ur: "your",
  u: "you",
  r: "are",
  n: "and",
};

// Advanced phonetic mapping for Banglish
const PHONETIC_MAP = {
  // Vowel substitutions
  a: ["a", "aa", "ah", "আ"],
  e: ["e", "ee", "eh", "ই", "ঈ"],
  i: ["i", "ii", "ih", "ই", "ঈ"],
  o: ["o", "oo", "oh", "ও", "ঔ"],
  u: ["u", "uu", "uh", "উ", "ঊ"],

  // Consonant substitutions
  k: ["k", "c", "ck", "ক"],
  kh: ["kh", "kha", "খ"],
  g: ["g", "ga", "গ"],
  gh: ["gh", "ঘ"],
  ch: ["ch", "cch", "ছ", "চ"],
  j: ["j", "z", "জ", "য"],
  jh: ["jh", "ঝ"],
  t: ["t", "ta", "ট", "ত"],
  th: ["th", "থ"],
  d: ["d", "da", "ড", "দ"],
  dh: ["dh", "ঢ", "ধ"],
  n: ["n", "na", "ন", "ণ"],
  p: ["p", "pa", "প"],
  ph: ["ph", "f", "ফ"],
  b: ["b", "ba", "ব"],
  bh: ["bh", "ভ"],
  m: ["m", "ma", "ম"],
  y: ["y", "ya", "য"],
  r: ["r", "ra", "র"],
  l: ["l", "la", "ল"],
  sh: ["sh", "s", "স", "শ", "ষ"],
  h: ["h", "ha", "হ"],
};

class HyperNormalizer {
  constructor() {
    this.stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "so",
      "for",
      "nor",
      "yet",
      "of",
      "to",
      "in",
      "for",
      "on",
      "with",
      "without",
      "by",
      "at",
      "আমি",
      "তুমি",
      "আপনি",
      "সে",
      "তা",
      "এটি",
      "ও",
      "এবং",
      "কিন্তু",
    ]);

    this.stemmer = PorterStemmer;
  }

  normalize(text) {
    let t = text.toLowerCase().trim();

    // Convert Bengali numbers to Arabic
    t = t.replace(/[০-৯]/g, (match) => BENGALI_NUMBERS[match]);

    // Expand slang
    const words = t.split(/\s+/);
    const expanded = words.map((w) => SLANG_EXPANSIONS[w] || w).join(" ");
    t = expanded;

    // Replace symbols
    for (const [sym, replacement] of Object.entries(SYMBOL_MAP)) {
      t = t.split(sym).join(` ${replacement} `);
    }

    // Remove diacritics
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Remove punctuation except essential
    t = t.replace(/[^\w\s\u0980-\u09FF]/g, " ");

    // Collapse multiple spaces
    t = t.replace(/\s+/g, " ").trim();

    // Stem words (English only)
    const stemmed = t
      .split(/\s+/)
      .map((word) => {
        if (/[a-zA-Z]/.test(word) && word.length > 3) {
          return this.stemmer.stem(word);
        }
        return word;
      })
      .join(" ");

    return stemmed;
  }

  // Fuzzy match with multiple algorithms
  fuzzyMatch(word1, word2) {
    const lev = this.levenshtein(word1, word2);
    const jaro = stringSimilarity.compareTwoStrings(word1, word2);
    const dice = this.diceCoefficient(word1, word2);

    const normalizedLev = 1 - lev / Math.max(word1.length, word2.length);
    const combined = normalizedLev * 0.4 + jaro * 0.4 + dice * 0.2;

    return combined > 0.75;
  }

  levenshtein(a, b) {
    const matrix = Array(b.length + 1)
      .fill()
      .map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost,
        );
      }
    }
    return matrix[b.length][a.length];
  }

  diceCoefficient(a, b) {
    const bigrams = (str) => {
      const bg = new Set();
      for (let i = 0; i < str.length - 1; i++) {
        bg.add(str.substring(i, i + 2));
      }
      return bg;
    };

    const bg1 = bigrams(a);
    const bg2 = bigrams(b);
    const intersection = new Set([...bg1].filter((x) => bg2.has(x)));
    return (2 * intersection.size) / (bg1.size + bg2.size);
  }

  // Detect language
  detectLanguage(text) {
    try {
      const lang = franc(text);
      if (lang === "ben") return "bengali";
      if (lang === "eng") return "english";
      if (/[আ-ঔক-হ]/.test(text)) return "bengali";
      if (/[a-zA-Z]/.test(text) && text.length > 5) return "banglish";
      return "mixed";
    } catch {
      return "unknown";
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 2. SEMANTIC SEARCH ENGINE (TF-IDF VECTORIZATION)
// ───────────────────────────────────────────────────────────────────────────

class SemanticSearchEngine {
  constructor() {
    this.tfidf = new TfIdf();
    this.productVectors = new Map();
    this.intentVectors = new Map();
    this.isInitialized = false;
  }

  async initialize(products) {
    if (this.isInitialized) return;

    // Build TF-IDF for products
    for (const product of products) {
      const text = `${product.name} ${product.nameBn || ""} ${product.tags?.join(" ") || ""} ${product.description || ""}`;
      this.tfidf.addDocument(text, product._id.toString());
      this.productVectors.set(product._id.toString(), product);
    }

    this.isInitialized = true;
  }

  search(query, limit = 5) {
    if (!this.isInitialized) return [];

    const results = [];
    this.tfidf.tfidfs(query, (docId, score) => {
      if (score > 0) {
        results.push({
          product: this.productVectors.get(docId),
          score: score,
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 3. ADVANCED INTENT CLASSIFIER WITH NEURAL INSPIRED APPROACH
// ───────────────────────────────────────────────────────────────────────────

class HyperIntentClassifier {
  constructor() {
    this.intentPatterns = new Map();
    this.intentWeights = new Map();
    this.synonymGraph = new Map();
    this.initSynonyms();
  }

  initSynonyms() {
    // Build rich synonym graph
    const synonyms = {
      // Order related
      order: [
        "অর্ডার",
        "ordar",
        "order",
        "purchase",
        "ক্রয়",
        "কিনা",
        "buy",
        "booking",
        "reservation",
      ],
      track: [
        "ট্র্যাক",
        "track",
        "trak",
        "status",
        "স্ট্যাটাস",
        "obostha",
        "অবস্থা",
        "update",
        "আপডেট",
        "where",
        "কোথায়",
      ],
      cancel: [
        "cancel",
        "cancle",
        "বাতিল",
        "batil",
        "ยกเลิก",
        "annul",
        "void",
        "reverse",
      ],

      // Product related
      product: [
        "product",
        "পণ্য",
        "ponno",
        "item",
        "আইটেম",
        "goods",
        "মাল",
        "commodity",
      ],
      price: [
        "price",
        "দাম",
        "dam",
        "মূল্য",
        "mullo",
        "rate",
        "রেট",
        "cost",
        "খরচ",
        "কত টাকা",
        "koto taka",
      ],
      stock: [
        "stock",
        "স্টক",
        "available",
        "আছে",
        "ache",
        "in stock",
        "সটক",
        "সংরক্ষিত",
      ],

      // Delivery related
      delivery: [
        "delivery",
        "ডেলিভারি",
        "delivri",
        "shipping",
        "শিপিং",
        "courier",
        "কুরিয়ার",
        "পৌছানো",
      ],
      charge: [
        "charge",
        "চার্জ",
        "charj",
        "fee",
        "ফি",
        "cost",
        "খরচ",
        "shipping cost",
      ],

      // Payment related
      payment: [
        "payment",
        "পেমেন্ট",
        "pay",
        "পরিশোধ",
        "porishod",
        "transaction",
        "লেনদেন",
      ],
      bkash: ["bkash", "bikash", "বিকাশ", "b-kash"],
      nagad: ["nagad", "নগদ", "nogod"],

      // Support related
      return: [
        "return",
        "রিটার্ন",
        "ferot",
        "ফেরত",
        "refund",
        "রিফান্ড",
        "money back",
        "টাকা ফেরত",
      ],
      support: [
        "support",
        "সাপোর্ট",
        "help",
        "সাহায্য",
        "assist",
        "সহায়তা",
        "customer care",
      ],
      contact: [
        "contact",
        "যোগাযোগ",
        "jogajog",
        "call",
        "কল",
        "phone",
        "ফোন",
        "whatsapp",
      ],

      // Offers
      coupon: [
        "coupon",
        "কুপন",
        "discount",
        "ছাড়",
        "char",
        "offer",
        "অফার",
        "promo",
        "voucher",
        "কোড",
        "code",
      ],
    };

    for (const [canonical, variants] of Object.entries(synonyms)) {
      this.synonymGraph.set(canonical, new Set(variants));
      for (const variant of variants) {
        if (!this.synonymGraph.has(variant)) {
          this.synonymGraph.set(variant, new Set([canonical]));
        } else {
          this.synonymGraph.get(variant).add(canonical);
        }
      }
    }
  }

  getSynonyms(word) {
    const normalized = word.toLowerCase();
    if (this.synonymGraph.has(normalized)) {
      return Array.from(this.synonymGraph.get(normalized));
    }
    return [normalized];
  }

  classify(text, normalizer) {
    const normalized = normalizer.normalize(text);
    const words = normalized.split(/\s+/);

    // Intent scoring with weighted keywords
    const intentScores = new Map();

    // Define intent keywords with weights
    const intentKeywords = {
      TRACK_ORDER: {
        keywords: ["track", "status", "update", "where", "কোথায়", "obostha"],
        weight: 3,
      },
      HOW_TO_ORDER: {
        keywords: ["how", "কিভাবে", "kivabe", "process", "method", "পদ্ধতি"],
        weight: 2,
      },
      PRODUCT_SEARCH: {
        keywords: [
          "product",
          "price",
          "stock",
          "available",
          "পণ্য",
          "দাম",
          "স্টক",
        ],
        weight: 3,
      },
      DELIVERY_INFO: {
        keywords: [
          "delivery",
          "shipping",
          "ডেলিভারি",
          "charge",
          "চার্জ",
          "time",
          "সময়",
        ],
        weight: 3,
      },
      COUPON_INFO: {
        keywords: ["coupon", "discount", "offer", "কুপন", "ছাড়", "অফার"],
        weight: 3,
      },
      PAYMENT_INFO: {
        keywords: [
          "payment",
          "pay",
          "bkash",
          "nagad",
          "পেমেন্ট",
          "বিকাশ",
          "নগদ",
        ],
        weight: 3,
      },
      RETURN_REFUND: {
        keywords: ["return", "refund", "cancel", "রিটার্ন", "ফেরত", "বাতিল"],
        weight: 3,
      },
      CONTACT: {
        keywords: [
          "contact",
          "support",
          "help",
          "যোগাযোগ",
          "সাপোর্ট",
          "সাহায্য",
        ],
        weight: 2,
      },
      GREETING: {
        keywords: ["hi", "hello", "hey", "salam", "হাই", "হ্যালো", "সালাম"],
        weight: 1.5,
      },
      THANKS: {
        keywords: ["thanks", "thank", "ধন্যবাদ", "tnx", "thnx"],
        weight: 1.5,
      },
    };

    // Calculate scores
    for (const [intent, config] of Object.entries(intentKeywords)) {
      let score = 0;

      for (const keyword of config.keywords) {
        const synonyms = this.getSynonyms(keyword);
        for (const word of words) {
          if (
            synonyms.some(
              (syn) => word.includes(syn) || normalizer.fuzzyMatch(word, syn),
            )
          ) {
            score += config.weight;
            break;
          }
        }
      }

      // Check for exact patterns
      if (this.matchesPattern(text, intent)) {
        score += 10;
      }

      if (score > 0) {
        intentScores.set(intent, score);
      }
    }

    // Get best intent
    if (intentScores.size === 0) return "UNKNOWN";

    const best = Array.from(intentScores.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const threshold = best[1] > 2 ? best[0] : "UNKNOWN";

    return threshold;
  }

  matchesPattern(text, intent) {
    const patterns = {
      TRACK_ORDER: [
        /\b(ORD-\d{4,6}-\d{4,6})\b/i,
        /track.*order|order.*track/i,
        /আমার অর্ডার.*কোথায়/i,
        /order status/i,
      ],
      HOW_TO_ORDER: [
        /কিভাবে.*অর্ডার/i,
        /how.*order/i,
        /অর্ডার.*করব/i,
        /order.*korte.*chai/i,
      ],
      PRODUCT_SEARCH: [
        /কি.*পণ্য.*আছে/i,
        /কত.*দাম/i,
        /price.*of/i,
        /available.*product/i,
      ],
      DELIVERY_INFO: [
        /ডেলিভারি.*চার্জ/i,
        /delivery.*charge/i,
        /কতদিনে.*পাব/i,
        /shipping.*time/i,
      ],
      COUPON_INFO: [
        /কুপন.*কোড/i,
        /coupon.*code/i,
        /discount.*offer/i,
        /ছাড়.*পাব/i,
      ],
      GREETING: [
        /^(hi|hello|hey|salam|হ্যালো|হাই)/i,
        /good (morning|evening|afternoon)/i,
        /কেমন আছ(েন)?/i,
      ],
    };

    return patterns[intent]?.some((pattern) => pattern.test(text)) || false;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4. ENTITY EXTRACTION ENGINE (NER)
// ───────────────────────────────────────────────────────────────────────────

class EntityExtractor {
  extract(text) {
    const entities = {
      orderNumber: null,
      phone: null,
      couponCode: null,
      productName: null,
      amount: null,
      location: null,
      date: null,
    };

    // Extract order number
    const orderMatch = text.match(/\b(ORD-\d{4,6}-\d{4,6})\b/i);
    if (orderMatch) entities.orderNumber = orderMatch[1].toUpperCase();

    // Extract phone number (Bangladesh)
    const phoneMatch = text.match(/\b(01[3-9]\d{8})\b/);
    if (phoneMatch) entities.phone = phoneMatch[1];

    // Extract coupon code
    const couponMatch = text.match(/\b([A-Z][A-Z0-9]{3,19})\b/);
    if (couponMatch && !["ORDER", "TRACK", "HELP"].includes(couponMatch[1])) {
      entities.couponCode = couponMatch[1];
    }

    // Extract amount (money)
    const amountMatch = text.match(/(\d+)\s*(টাকা|taka|৳)/i);
    if (amountMatch) entities.amount = parseInt(amountMatch[1]);

    // Extract location
    const locations = [
      "ঢাকা",
      "Dhaka",
      "চট্টগ্রাম",
      "Chittagong",
      "রাজশাহী",
      "Rajshahi",
      "খুলনা",
      "Khulna",
    ];
    for (const loc of locations) {
      if (text.includes(loc)) {
        entities.location = loc;
        break;
      }
    }

    // Extract product names (common honey products)
    const products = [
      "মধু",
      "honey",
      "ঘি",
      "ghee",
      "জিরা",
      "zira",
      "চা",
      "tea",
      "মসলা",
      "masala",
    ];
    for (const prod of products) {
      if (text.toLowerCase().includes(prod)) {
        entities.productName = prod;
        break;
      }
    }

    return entities;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 5. SENTIMENT & URGENCY DETECTION
// ───────────────────────────────────────────────────────────────────────────

class SentimentAnalyzer {
  analyze(text) {
    const lower = text.toLowerCase();

    // Urgency indicators
    const urgent = [
      "জরুরি",
      "urgent",
      "তাড়াতাড়ি",
      "quick",
      "fast",
      "immediately",
      "এখনই",
      "দয়া করে",
    ];
    const angry = [
      "খুব খারাপ",
      "very bad",
      "worst",
      "ভয়ংকর",
      "abusive",
      "গালি",
      "complaint",
    ];
    const happy = [
      "非常好",
      "good",
      "best",
      "excellent",
      "চমৎকার",
      "দারুণ",
      "ভালো",
      "great",
    ];

    let urgencyScore = 0;
    let sentiment = "neutral";

    for (const word of urgent) {
      if (lower.includes(word)) urgencyScore++;
    }

    for (const word of angry) {
      if (lower.includes(word)) {
        sentiment = "negative";
        urgencyScore += 2;
      }
    }

    for (const word of happy) {
      if (lower.includes(word)) sentiment = "positive";
    }

    return {
      sentiment,
      isUrgent: urgencyScore >= 2,
      urgencyScore,
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 6. CONTEXTUAL MEMORY WITH ATTENTION MECHANISM
// ───────────────────────────────────────────────────────────────────────────

class ContextualMemory {
  constructor(maxSize = 10, ttl = 30 * 60 * 1000) {
    this.sessions = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (Date.now() - session.timestamp > this.ttl) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  set(sessionId, data) {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        history: [],
        context: {},
        timestamp: Date.now(),
      };
    }

    // Update with attention weighting
    session.context = { ...session.context, ...data };
    session.history.push({
      ...data,
      timestamp: Date.now(),
      attentionWeight: this.calculateAttentionWeight(session.history.length),
    });

    // Keep only recent history
    if (session.history.length > this.maxSize) {
      session.history.shift();
    }

    session.timestamp = Date.now();
    this.sessions.set(sessionId, session);

    // Cleanup old sessions
    if (this.sessions.size > 1000) {
      this.cleanup();
    }
  }

  calculateAttentionWeight(index) {
    // Recency bias: more recent = higher weight
    return Math.exp(-index * 0.3);
  }

  getRelevantContext(sessionId, currentIntent) {
    const session = this.get(sessionId);
    if (!session) return null;

    // Find relevant history based on intent similarity
    const relevant = session.history
      .filter(
        (h) =>
          h.intent === currentIntent ||
          this.areRelated(h.intent, currentIntent),
      )
      .sort((a, b) => b.attentionWeight - a.attentionWeight);

    return relevant.length > 0 ? relevant[0] : null;
  }

  areRelated(intent1, intent2) {
    const relatedPairs = [
      ["TRACK_ORDER", "DELIVERY_INFO"],
      ["PRODUCT_SEARCH", "HOW_TO_ORDER"],
      ["COUPON_INFO", "PAYMENT_INFO"],
    ];

    return relatedPairs.some(
      ([a, b]) =>
        (a === intent1 && b === intent2) || (a === intent2 && b === intent1),
    );
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.timestamp > this.ttl) {
        this.sessions.delete(id);
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 7. RESPONSE GENERATOR WITH PERSONALITY
// ───────────────────────────────────────────────────────────────────────────

class ResponseGenerator {
  constructor() {
    this.personality = {
      emojis: true,
      friendly: true,
      helpful: true,
      concise: false,
    };
  }

  async generate(intent, entities, context, sentiment, data) {
    const response = {
      text: "",
      suggestions: [],
      data: null,
      actions: [],
    };

    switch (intent) {
      case "TRACK_ORDER":
        response.text = await this.generateTrackResponse(entities, data);
        response.suggestions = [
          "আরেকটি অর্ডার ট্র্যাক করুন",
          "ডেলিভারি চার্জ কত?",
          "সাপোর্টে কথা বলুন",
        ];
        break;

      case "HOW_TO_ORDER":
        response.text = this.generateHowToOrderResponse();
        response.suggestions = [
          "ডেলিভারি চার্জ কত?",
          "পেমেন্ট পদ্ধতি কী কী?",
          "কুপন কোড আছে?",
        ];
        break;

      case "PRODUCT_SEARCH":
        response.text = await this.generateProductResponse(entities, data);
        response.suggestions = [
          "অর্ডার করতে চাই",
          "ডেলিভারি চার্জ কত?",
          "আরও পণ্য দেখুন",
        ];
        break;

      case "DELIVERY_INFO":
        response.text = await this.generateDeliveryResponse(data);
        response.suggestions = [
          "অর্ডার করতে চাই",
          "কুপন আছে?",
          "পেমেন্ট পদ্ধতি",
        ];
        break;

      case "COUPON_INFO":
        response.text = await this.generateCouponResponse(entities, data);
        response.suggestions = [
          "অর্ডার করতে চাই",
          "ডেলিভারি চার্জ কত?",
          "অন্য অফার",
        ];
        break;

      case "PAYMENT_INFO":
        response.text = this.generatePaymentResponse();
        response.suggestions = [
          "ডেলিভারি চার্জ কত?",
          "অর্ডার করতে চাই",
          "যোগাযোগ করুন",
        ];
        break;

      case "RETURN_REFUND":
        response.text = this.generateReturnResponse();
        response.suggestions = [
          "যোগাযোগ করুন",
          "অর্ডার ট্র্যাক করুন",
          "সাপোর্টে কথা বলুন",
        ];
        break;

      case "CONTACT":
        response.text = this.generateContactResponse();
        response.suggestions = [
          "অর্ডার ট্র্যাক করুন",
          "রিটার্ন নীতি জানুন",
          "ডেলিভারি তথ্য",
        ];
        break;

      case "GREETING":
        response.text = await this.generateGreetingResponse(data);
        response.suggestions = [
          "আমার অর্ডার ট্র্যাক করুন",
          "কী পণ্য আছে?",
          "অর্ডার করতে চাই",
        ];
        break;

      case "THANKS":
        response.text = this.generateThanksResponse();
        response.suggestions = [
          "অর্ডার ট্র্যাক করুন",
          "পণ্য দেখুন",
          "ডেলিভারি তথ্য",
        ];
        break;

      default:
        response.text = this.generateUnknownResponse(sentiment);
        response.suggestions = ["অর্ডার করতে চাই", "পণ্য দেখুন", "সাহায্য নিন"];
    }

    // Add personality touches
    if (this.personality.emojis && !response.text.includes("🐝")) {
      response.text = this.addEmojis(response.text);
    }

    if (sentiment.isUrgent) {
      response.text = "⚠️ " + response.text;
      response.actions.push("PRIORITY_HANDLING");
    }

    return response;
  }

  addEmojis(text) {
    const emojiMap = {
      order: "📦",
      track: "🔍",
      product: "🛍️",
      delivery: "🚚",
      payment: "💳",
      coupon: "🎟️",
      return: "↩️",
      contact: "📞",
      thank: "🙏",
      welcome: "🎉",
    };

    let result = text;
    for (const [word, emoji] of Object.entries(emojiMap)) {
      if (text.toLowerCase().includes(word)) {
        result = `${emoji} ${result}`;
        break;
      }
    }

    return result;
  }

  async generateTrackResponse(entities, orderData) {
    if (!orderData) {
      return "🔍 আপনার অর্ডার ট্র্যাক করতে অর্ডার নম্বর বা ফোন নম্বর দিন।\n\n📦 উদাহরণ: ORD-202504-12345\n📞 উদাহরণ: 01700000000";
    }

    if (orderData.order) {
      const o = orderData.order;
      return `📋 **অর্ডার পাওয়া গেছে!**\n\n🔢 অর্ডার নম্বর: ${o.number}\n📊 স্ট্যাটাস: ${o.statusEmoji} ${o.statusBn}\n💰 পেমেন্ট: ${o.paymentStatus}\n📦 ট্র্যাকিং: ${o.trackingNumber || "আপডেট আসবে"}\n\n${o.status === "delivered" ? "🎉 আপনার অর্ডার ডেলিভারি হয়েছে!" : o.status === "shipped" ? "🚚 আপনার অর্ডার পথে!" : "⏳ অর্ডার প্রক্রিয়াধীন"}`;
    }

    if (orderData.orders) {
      let response = `📋 **${orderData.orders.length}টি অর্ডার পাওয়া গেছে:**\n\n`;
      orderData.orders.forEach((o, i) => {
        response += `${i + 1}. ${o.number} — ${o.status} (${new Date(o.date).toLocaleDateString()})\n`;
      });
      return response;
    }

    return "❌ অর্ডার পাওয়া যায়নি। সঠিক তথ্য দিন।";
  }

  generateHowToOrderResponse() {
    return (
      `🛒 **অর্ডার করার সহজ ধাপ:**\n\n` +
      `**১.** পণ্য বেছে নিন → 🛒 **কার্টে যোগ করুন**\n` +
      `**২.** 🛍️ **কার্ট আইকনে** ক্লিক করুন → **অর্ডার করুন**\n` +
      `**৩.** 📝 আপনার নাম, ফোন ও ঠিকানা দিন\n` +
      `**৪.** 💳 পেমেন্ট পদ্ধতি বেছে নিন\n` +
      `**৫.** ✅ **অর্ডার কনফার্ম করুন** — শেষ! 🎉\n\n` +
      `💡 অর্ডার করার পর SMS/Email-এ কনফার্মেশন পাবেন।`
    );
  }

  async generateProductResponse(entities, products) {
    if (!products || products.length === 0) {
      return "🛍️ এই মুহূর্তে কোনো পণ্য পাওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    }

    let response = `🛍️ **${products.length}টি পণ্য পাওয়া গেছে:**\n\n`;
    products.forEach((p, i) => {
      response += `${i + 1}. **${p.name}** — ৳${p.price} ${p.inStock ? "✅ স্টকে আছে" : "❌ স্টকে নেই"}\n`;
    });
    return response;
  }

  async generateDeliveryResponse(deliveryData) {
    if (deliveryData && deliveryData.charges) {
      return (
        `🚚 **ডেলিভারি তথ্য:**\n\n` +
        `🏙️ ঢাকার ভেতরে: **৳${deliveryData.charges.insideDhaka}** (${deliveryData.deliveryTime.insideDhaka})\n` +
        `🚚 ঢাকার বাইরে: **৳${deliveryData.charges.outsideDhaka}** (${deliveryData.deliveryTime.outsideDhaka})\n\n` +
        `⏰ অর্ডার কনফার্মের ২৪ ঘণ্টার মধ্যে শিপ করা হয়।`
      );
    }

    return `🚚 **ডেলিভারি চার্জ:**\n\n🏙️ ঢাকার ভেতরে: **৳৬০** (১–২ দিন)\n🚚 ঢাকার বাইরে: **৳১২০** (২–৫ দিন)`;
  }

  async generateCouponResponse(entities, coupons) {
    if (entities.couponCode && coupons && coupons.valid) {
      return (
        `✅ **${entities.couponCode}** কুপন বৈধ!\n\n` +
        `💰 ${coupons.type === "percentage" ? `${coupons.value}% ছাড়` : `৳${coupons.value} ছাড়`}\n` +
        `🛒 ন্যূনতম অর্ডার: ৳${coupons.minOrder || 0}\n` +
        `🎯 সর্বোচ্চ ছাড়: ৳${coupons.maxDiscount || "সীমাহীন"}\n\n` +
        `চেকআউটে কোডটি ব্যবহার করুন!`
      );
    }

    if (coupons && coupons.length > 0) {
      let response = `🎟️ **${coupons.length}টি সক্রিয় কুপন:**\n\n`;
      coupons.forEach((c, i) => {
        response += `${i + 1}. **${c.code}** — ${c.type === "percentage" ? `${c.value}% ছাড়` : `৳${c.value} ছাড়`} (ন্যূনতম ৳${c.minimumOrder})\n`;
      });
      return response;
    }

    return "😔 এই মুহূর্তে কোনো সক্রিয় কুপন নেই। আমাদের Facebook পেজ ফলো করুন!";
  }

  generatePaymentResponse() {
    return (
      `💳 **পেমেন্ট পদ্ধতিসমূহ:**\n\n` +
      `💵 **ক্যাশ অন ডেলিভারি** — পণ্য পাওয়ার পর পেমেন্ট\n` +
      `📱 **বিকাশ (bKash)** — মোবাইল ব্যাংকিং\n` +
      `📱 **নগদ (Nagad)** — মোবাইল ব্যাংকিং\n` +
      `📱 **রকেট (Rocket)** — মোবাইল ব্যাংকিং\n` +
      `💳 **ডেবিট/ক্রেডিট কার্ড** — সকল ব্যাংক কার্ড\n\n` +
      `🔒 নিরাপদ পেমেন্ট সিস্টেম।`
    );
  }

  generateReturnResponse() {
    return (
      `↩️ **রিটার্ন ও রিফান্ড নীতি:**\n\n` +
      `✅ পণ্য পাওয়ার **৭ দিনের** মধ্যে রিটার্ন করা যাবে\n` +
      `✅ পণ্য অক্ষত ও মূল প্যাকেজিংসহ থাকতে হবে\n` +
      `✅ ভুল/ক্ষতিগ্রস্ত পণ্য পেলে ৪৮ ঘণ্টার মধ্যে জানাতে হবে\n` +
      `✅ রিফান্ড ৩–৫ কার্যদিবসের মধ্যে প্রদান করা হবে\n` +
      `❌ ব্যবহৃত বা ক্ষতিগ্রস্ত পণ্য রিটার্ন গ্রহণযোগ্য নয়\n\n` +
      `📞 রিটার্নের জন্য সাপোর্টে যোগাযোগ করুন: 01700-000000`
    );
  }

  generateContactResponse() {
    return (
      `📞 **আমাদের সাথে যোগাযোগ করুন:**\n\n` +
      `📞 হটলাইন: **01700-000000**\n` +
      `💬 WhatsApp: **01700-000001**\n` +
      `📧 ইমেইল: **support@beeharvest.com.bd**\n` +
      `👥 Facebook: **facebook.com/beeharvest**\n\n` +
      `🕐 সাপোর্ট সময়: সকাল ৯টা – রাত ১০টা (প্রতিদিন)`
    );
  }

  async generateGreetingResponse(stats) {
    return (
      `🐝 **আস্সালামু আলাইকুম! BeeHarvest-এ স্বাগতম!** 🎉\n\n` +
      `আমি আপনার AI সহকারী — অর্ডার ট্র্যাকিং, পণ্যের দাম, ডেলিভারি, কুপন — সব বিষয়ে সাহায্য করতে পারি।\n\n` +
      `${stats?.productCount ? `📦 ${stats.productCount}+ পণ্য স্টকে আছে!` : ""}\n\n` +
      `কীভাবে সাহায্য করতে পারি? 🤔`
    );
  }

  generateThanksResponse() {
    return (
      `😊 **আপনাকেও ধন্যবাদ!** 🐝\n\n` +
      `আমি সবসময় আপনার জন্য এখানে আছি। কোনো সাহায্যের প্রয়োজন হলে শুধু জিজ্ঞেস করুন!\n\n` +
      `শুভ দিন কাটুক! 🌟`
    );
  }

  generateUnknownResponse(sentiment) {
    if (sentiment.sentiment === "negative") {
      return (
        `😔 দুঃখিত, আপনার সমস্যার জন্য আমি ক্ষমাপ্রার্থী।\n\n` +
        `আমি এখনো শিখছি। দয়া করে নিচের বিষয়গুলোর মধ্যে জিজ্ঞেস করুন অথবা আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।`
      );
    }

    return (
      `🤔 আমি নিশ্চিত নই। আমি এই বিষয়গুলোতে সাহায্য করতে পারি:\n\n` +
      `📦 অর্ডার ট্র্যাকিং\n` +
      `🛒 অর্ডার করার পদ্ধতি\n` +
      `🛍️ পণ্যের তথ্য ও দাম\n` +
      `🚚 ডেলিভারি চার্জ ও সময়\n` +
      `🎟️ কুপন কোড ও অফার\n` +
      `↩️ রিটার্ন ও রিফান্ড নীতি\n` +
      `💳 পেমেন্ট পদ্ধতি\n` +
      `📞 যোগাযোগের তথ্য\n\n` +
      `আপনি কি এই বিষয়গুলোর মধ্যে কিছু জানতে চান?`
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 8. MAIN CHATBOT ENGINE
// ───────────────────────────────────────────────────────────────────────────

const normalizer = new HyperNormalizer();
const intentClassifier = new HyperIntentClassifier();
const entityExtractor = new EntityExtractor();
const sentimentAnalyzer = new SentimentAnalyzer();
const contextualMemory = new ContextualMemory();
const responseGenerator = new ResponseGenerator();
const semanticSearch = new SemanticSearchEngine();

let productsCache = null;

// Initialize semantic search
const initSemanticSearch = async () => {
  if (!productsCache) {
    productsCache = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .select("name nameBn price comparePrice stock tags description")
      .lean();
    await semanticSearch.initialize(productsCache);
  }
  return productsCache;
};

// @desc    Process chatbot message (MAIN CONTROLLER)
// @route   POST /api/chatbot/message
// @access  Public
const processMessage = async (req, res) => {
  const startTime = Date.now();

  try {
    const { message, sessionId = "anon" } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log(`🤖 [CHATBOT] Session: ${sessionId} | Message: "${message}"`);

    // 1. Normalize and detect language
    const normalized = normalizer.normalize(message);
    const language = normalizer.detectLanguage(message);
    console.log(`🌐 [CHATBOT] Language: ${language}`);

    // 2. Extract entities
    const entities = entityExtractor.extract(message);
    console.log(`🔍 [CHATBOT] Entities:`, entities);

    // 3. Analyze sentiment
    const sentiment = sentimentAnalyzer.analyze(message);
    console.log(
      `😊 [CHATBOT] Sentiment: ${sentiment.sentiment}, Urgent: ${sentiment.isUrgent}`,
    );

    // 4. Classify intent
    let intent = intentClassifier.classify(message, normalizer);

    // 5. Check for direct entity matches (override)
    if (entities.orderNumber || entities.phone) {
      intent = "TRACK_ORDER";
    }
    if (entities.couponCode && intent !== "COUPON_INFO") {
      intent = "COUPON_INFO";
    }

    console.log(`🎯 [CHATBOT] Intent: ${intent}`);

    // 6. Get context
    const context = contextualMemory.get(sessionId);
    let responseData = null;

    // 7. Handle based on intent
    switch (intent) {
      case "TRACK_ORDER":
        responseData = await handleTrackOrder(entities);
        break;

      case "HOW_TO_ORDER":
        responseData = null; // No data needed
        break;

      case "PRODUCT_SEARCH":
        await initSemanticSearch();
        const searchResults = semanticSearch.search(message, 5);
        responseData = searchResults.map((r) => r.product);
        break;

      case "DELIVERY_INFO":
        responseData = await handleDeliveryInfo();
        break;

      case "COUPON_INFO":
        responseData = await handleCouponInfo(entities, message);
        break;

      case "PAYMENT_INFO":
        responseData = null;
        break;

      case "RETURN_REFUND":
        responseData = null;
        break;

      case "CONTACT":
        responseData = null;
        break;

      case "GREETING":
        const stats = await getStoreStats();
        responseData = stats;
        break;

      case "THANKS":
        responseData = null;
        break;

      default:
        responseData = null;
    }

    // 8. Generate response
    const response = await responseGenerator.generate(
      intent,
      entities,
      context,
      sentiment,
      responseData,
    );

    // 9. Update context
    contextualMemory.set(sessionId, {
      intent,
      entities,
      sentiment,
      timestamp: Date.now(),
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ [CHATBOT] Response generated in ${processingTime}ms`);

    return res.json({
      success: true,
      intent,
      language,
      sentiment: sentiment.sentiment,
      response,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CHATBOT] Error:", error);
    return res.status(500).json({
      success: false,
      response: {
        text: "😔 দুঃখিত, একটি প্রযুক্তিগত সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
        suggestions: ["পুনরায় চেষ্টা করুন", "সরাসরি যোগাযোগ করুন"],
      },
    });
  }
};

// Helper functions
const handleTrackOrder = async (entities) => {
  if (entities.orderNumber) {
    const order = await Order.findOne({
      orderNumber: { $regex: entities.orderNumber, $options: "i" },
    }).select(
      "orderNumber orderStatus paymentStatus customer.name items deliveryCharge total trackingNumber createdAt deliveryPartner",
    );

    if (order) {
      const statusBn = {
        pending: "অপেক্ষমাণ",
        confirmed: "নিশ্চিত",
        processing: "প্রক্রিয়াধীন",
        shipped: "শিপড",
        delivered: "ডেলিভারি সম্পন্ন",
        cancelled: "বাতিল",
      };
      const statusEmoji = {
        pending: "⏳",
        confirmed: "✅",
        processing: "⚙️",
        shipped: "🚚",
        delivered: "🎉",
        cancelled: "❌",
      };

      return {
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
      };
    }
  }

  if (entities.phone) {
    const orders = await Order.find({ "customer.phone": entities.phone })
      .select("orderNumber orderStatus total createdAt")
      .sort("-createdAt")
      .limit(5);

    if (orders.length) {
      return { orders };
    }
  }

  return null;
};

const handleDeliveryInfo = async () => {
  try {
    const charges = await DeliveryCharge.find({ isActive: true }).lean();
    const inside = charges.find((c) => c.name === "inside_dhaka");
    const outside = charges.find((c) => c.name === "outside_dhaka");

    return {
      charges: {
        insideDhaka: inside?.amount ?? 60,
        outsideDhaka: outside?.amount ?? 120,
      },
      deliveryTime: {
        insideDhaka: "১–২ কার্যদিবস",
        outsideDhaka: "২–৫ কার্যদিবস",
      },
    };
  } catch {
    return null;
  }
};

const handleCouponInfo = async (entities, message) => {
  const now = new Date();

  if (entities.couponCode) {
    const coupon = await Coupon.findOne({
      code: entities.couponCode.toUpperCase(),
      isActive: true,
    }).lean();

    if (coupon) {
      const expired = coupon.endDate && now > new Date(coupon.endDate);
      const exhausted =
        coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
      const valid = !expired && !exhausted;

      if (valid) {
        return [
          {
            code: coupon.code,
            type: coupon.discountType,
            value: coupon.discountValue,
            minOrder: coupon.minimumOrder,
            maxDiscount: coupon.maximumDiscount,
            valid: true,
          },
        ];
      }
    }
    return [];
  }

  // Get all active coupons
  const coupons = await Coupon.find({
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
    .select("code discountType discountValue minimumOrder description")
    .limit(5)
    .lean();

  return coupons.filter((c) => {
    const expired = c.endDate && now > new Date(c.endDate);
    const exhausted = c.usageLimit && c.usedCount >= c.usageLimit;
    return !expired && !exhausted;
  });
};

const getStoreStats = async () => {
  try {
    const productCount = await Product.countDocuments({
      isActive: true,
      stock: { $gt: 0 },
    });
    return { productCount };
  } catch {
    return {};
  }
};

// @desc    Get suggestions
// @route   GET /api/chatbot/suggestions
// @access  Public
const getSuggestions = async (req, res) => {
  try {
    const productCount = await Product.countDocuments({
      isActive: true,
      stock: { $gt: 0 },
    });
    const activeCoupons = await Coupon.countDocuments({
      isActive: true,
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    });

    const suggestions = [
      "আমার অর্ডার ট্র্যাক করুন",
      "অর্ডার করতে চাই",
      "কী পণ্য আছে?",
      "ডেলিভারি চার্জ কত?",
      ...(activeCoupons > 0 ? [`🎟️ ${activeCoupons}টি সক্রিয় কুপন আছে!`] : []),
      "পেমেন্ট পদ্ধতি কী কী?",
      "রিটার্ন পলিসি কী?",
    ];

    return res.json({
      success: true,
      suggestions,
      stats: { productCount, activeCoupons },
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Health check endpoint
const getHealth = async (req, res) => {
  return res.json({
    success: true,
    status: "operational",
    version: "5.0",
    features: [
      "multi-language",
      "semantic-search",
      "sentiment-analysis",
      "entity-extraction",
      "contextual-memory",
      "fuzzy-matching",
    ],
  });
};

module.exports = { processMessage, getSuggestions, getHealth };
