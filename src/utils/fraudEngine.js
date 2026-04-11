/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              BeeHarvest Fraud Detection Engine v1.1              ║
 * ║   Hardened against missing/null fields from real order data      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

const Order = require("../models/Order");
const FraudLog = require("../models/FraudLog");
const crypto = require("crypto");

// ─── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  SAFE: 30,
  REVIEW: 60,
  BLOCK: 60,
};

// ─── Signal Weights (must sum to 100) ─────────────────────────────────────────
const WEIGHTS = {
  velocity: 25,
  orderPattern: 20,
  customerProfile: 20,
  addressRisk: 15,
  paymentBehavior: 12,
  deviceFingerprint: 8,
};

const SUSPICIOUS_PHONE_PREFIXES = ["016", "019"];

const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwam.com",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "guerrillamail.info",
  "trashmail.com",
  "loadtest.com",
  "fakeinbox.com",
  "maildrop.cc",
  "mintemail.com",
  "dispostable.com",
  "spamgourmet.com",
  "trashmail.at",
  "trashmail.io",
  "mailnull.com",
  "spamgourmet.net",
  "10minutemail.com",
  "tempr.email",
  "discard.email",
];

const HIGH_RISK_AREA_KEYWORDS = [
  "unknown",
  "test",
  "xxx",
  "n/a",
  "na",
  "null",
  "fake",
  "asdf",
  "qwerty",
  "1234",
  "abcd",
  "temp",
  "demo",
];

const BOT_UA_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /axios/i,
  /postman/i,
  /insomnia/i,
  /go-http/i,
  /java\//i,
  /libwww/i,
];

// ─── Normalize incoming order data to safe defaults ───────────────────────────
function normalizeOrderData(orderData) {
  const o = { ...orderData };

  // Customer defaults
  if (!o.customer || typeof o.customer !== "object") o.customer = {};
  o.customer.name = (o.customer.name || "").trim();
  o.customer.email = (o.customer.email || "").trim().toLowerCase();
  o.customer.phone = (o.customer.phone || "").trim();
  if (!o.customer.address || typeof o.customer.address !== "object") {
    o.customer.address = {};
  }

  // Order fields
  o.items = Array.isArray(o.items) ? o.items : [];
  o.total = Number(o.total) || 0;
  o.subtotal = Number(o.subtotal) || 0;
  o.deliveryCharge = Number(o.deliveryCharge) || 0;
  o.discount = Number(o.discount) || 0;
  o.paymentMethod = o.paymentMethod || "";

  // Normalize each item — handle both populated and non-populated products
  o.items = o.items.map((item) => ({
    name: item.name || item.product?.name || "Unknown Product",
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    total:
      Number(item.total) || Number(item.price) * Number(item.quantity) || 0,
    sku: item.sku || "",
  }));

  return o;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 1: VELOCITY CHECK
// ══════════════════════════════════════════════════════════════════════════════
async function checkVelocity(orderData) {
  const { customer } = orderData;
  const now = new Date();
  const flags = [];
  let score = 0;

  // Can't do velocity checks without at least one identifier
  if (!customer.phone && !customer.email) {
    return {
      score: 0,
      flags: ["No phone or email — velocity check skipped"],
      data: {},
    };
  }

  const windows = [
    { label: "1min", ms: 1 * 60 * 1000, limit: 1, points: 40 },
    { label: "5min", ms: 5 * 60 * 1000, limit: 2, points: 30 },
    { label: "1hour", ms: 60 * 60 * 1000, limit: 5, points: 20 },
    { label: "24hr", ms: 24 * 60 * 60 * 1000, limit: 10, points: 10 },
  ];

  const phoneCount = {};
  const emailCount = {};

  for (const w of windows) {
    const since = new Date(now - w.ms);

    const [byPhone, byEmail] = await Promise.all([
      customer.phone
        ? Order.countDocuments({
            "customer.phone": customer.phone,
            createdAt: { $gte: since },
          })
        : Promise.resolve(0),
      customer.email
        ? Order.countDocuments({
            "customer.email": customer.email,
            createdAt: { $gte: since },
          })
        : Promise.resolve(0),
    ]);

    phoneCount[w.label] = byPhone;
    emailCount[w.label] = byEmail;

    if (byPhone > w.limit) {
      score += w.points;
      flags.push(`${byPhone} orders from same phone in last ${w.label}`);
    }
    if (byEmail > w.limit) {
      score += Math.round(w.points * 0.8);
      flags.push(`${byEmail} orders from same email in last ${w.label}`);
    }
  }

  // Same name, different phones — only if name is meaningful
  let nameVariants = 0;
  if (customer.name && customer.name.length >= 3 && customer.phone) {
    try {
      nameVariants = await Order.countDocuments({
        "customer.name": {
          $regex: new RegExp(`^${escapeRegex(customer.name)}$`, "i"),
        },
        "customer.phone": { $ne: customer.phone },
        createdAt: { $gte: new Date(now - 3600000) },
      });
      if (nameVariants > 2) {
        score += 25;
        flags.push(
          `Same name used with ${nameVariants} different phones in 1h`,
        );
      }
    } catch (err) {
      console.warn("⚠️ [FRAUD] nameVariants query failed:", err.message);
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { phoneCount, emailCount, nameVariants },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 2: ORDER PATTERN ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
function checkOrderPattern(orderData) {
  const { items, total, subtotal, deliveryCharge, discount } = orderData;
  const flags = [];
  let score = 0;

  // High value checks
  if (total > 50000) {
    score += 30;
    flags.push(`Very high order value: ৳${total.toLocaleString()}`);
  } else if (total > 20000) {
    score += 15;
    flags.push(`High order value: ৳${total.toLocaleString()}`);
  }

  // Bulk quantity
  const highQtyItems = items.filter((i) => i.quantity > 20);
  if (highQtyItems.length > 0) {
    score += 25;
    flags.push(
      `Bulk quantity: ${highQtyItems.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`,
    );
  } else if (items.some((i) => i.quantity > 10)) {
    score += 12;
    flags.push("Unusually high item quantity (>10)");
  }

  // Too many distinct items
  if (items.length > 15) {
    score += 20;
    flags.push(`Suspiciously many distinct items: ${items.length}`);
  }

  // Discount ratio checks
  if (discount > 0 && subtotal > 0) {
    const discountRatio = discount / subtotal;
    if (discountRatio >= 0.8) {
      score += 35;
      flags.push(
        `Extreme discount ratio: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    } else if (discountRatio >= 0.5) {
      score += 15;
      flags.push(
        `High discount ratio: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    }
  }

  // Free delivery on large order
  if (deliveryCharge === 0 && total > 1000) {
    score += 10;
    flags.push("Free delivery on large order — verify coupon legitimacy");
  }

  // Recalculate and compare — only flag if items have valid prices
  const itemsWithPrices = items.filter((i) => i.price > 0 && i.quantity > 0);
  if (itemsWithPrices.length > 0) {
    const expectedSubtotal = itemsWithPrices.reduce(
      (s, i) => s + i.price * i.quantity,
      0,
    );

    if (subtotal > 0 && Math.abs(expectedSubtotal - subtotal) > 5) {
      score += 40;
      flags.push(
        `Subtotal mismatch: expected ৳${expectedSubtotal.toFixed(0)} got ৳${subtotal}`,
      );
    }

    const expectedTotal = Math.max(
      0,
      expectedSubtotal + deliveryCharge - discount,
    );
    if (total > 0 && Math.abs(expectedTotal - total) > 5) {
      score += 40;
      flags.push(
        `Total mismatch: expected ৳${expectedTotal.toFixed(0)} got ৳${total}`,
      );
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { total, itemCount: items.length, discount },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 3: CUSTOMER PROFILE ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
function checkCustomerProfile(orderData) {
  const { customer } = orderData;
  const { name, email, phone } = customer;
  const flags = [];
  let score = 0;

  // Name checks
  if (!name || name.length < 3) {
    score += 20;
    flags.push("Name too short or missing");
  }
  if (name && /^[\d\s\W]+$/.test(name)) {
    score += 30;
    flags.push("Name contains only numbers or special characters");
  }
  if (name && /(.)\1{3,}/.test(name)) {
    score += 20;
    flags.push("Repeated character pattern in name");
  }
  if (name && /(qwerty|asdf|zxcv|1234|abcd)/i.test(name)) {
    score += 25;
    flags.push("Keyboard pattern detected in name");
  }

  // Email checks
  const emailDomain = email ? email.split("@")[1]?.toLowerCase() : null;
  if (!email || !email.includes("@")) {
    score += 25;
    flags.push("Invalid email format");
  } else if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 40;
    flags.push(`Disposable email domain: ${emailDomain}`);
  }
  if (email) {
    const localPart = email.split("@")[0];
    if (/^[a-z0-9]{8,}$/.test(localPart) && !/[aeiou]{2,}/.test(localPart)) {
      score += 15;
      flags.push("Email local part looks auto-generated");
    }
    if (/test\d+|user\d+|demo\d+|fake\d+/i.test(localPart)) {
      score += 20;
      flags.push("Generic test/fake email pattern");
    }
  }

  // Phone checks
  if (!phone) {
    score += 30;
    flags.push("Missing phone number");
  } else {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 11) {
      score += 25;
      flags.push(`Invalid phone length: ${cleanPhone.length} digits`);
    }
    if (/^(\d)\1+$/.test(cleanPhone)) {
      score += 40;
      flags.push("Phone number is all same digit");
    }
    if (/01234567890|09876543210/.test(cleanPhone)) {
      score += 35;
      flags.push("Sequential phone number detected");
    }
    if (SUSPICIOUS_PHONE_PREFIXES.some((p) => cleanPhone.startsWith(p))) {
      score += 5;
      flags.push(
        `Phone prefix flagged (soft signal): ${cleanPhone.slice(0, 3)}`,
      );
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { emailDomain, phoneLength: phone?.replace(/\D/g, "").length || 0 },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 4: ADDRESS RISK
// Matches your Order schema: { street, city, area, postalCode, district, division }
// ══════════════════════════════════════════════════════════════════════════════
function checkAddressRisk(orderData) {
  const addr = orderData.customer.address || {};
  const flags = [];
  let score = 0;

  // Your schema has: street, city, area — check for these
  const requiredFields = ["street", "city"];
  const missingFields = requiredFields.filter(
    (f) => !addr[f] || String(addr[f]).trim() === "",
  );

  if (missingFields.length === requiredFields.length) {
    score += 35;
    flags.push("Completely missing delivery address");
  } else if (missingFields.length > 0) {
    score += missingFields.length * 10;
    flags.push(`Missing address fields: ${missingFields.join(", ")}`);
  }

  // Check for suspicious keywords across all address values
  const addressText = Object.values(addr)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const badKeywords = HIGH_RISK_AREA_KEYWORDS.filter((k) =>
    addressText.includes(k),
  );
  if (badKeywords.length > 0) {
    score += Math.min(badKeywords.length * 15, 45);
    flags.push(`Suspicious address content: ${badKeywords.join(", ")}`);
  }

  // Short street address
  if (addr.street && String(addr.street).trim().length < 5) {
    score += 10;
    flags.push("Street address suspiciously short");
  }

  // Repeated chars in address
  const hasRepeatedChars = Object.values(addr).some(
    (v) => v && /(.)\1{3,}/.test(String(v)),
  );
  if (hasRepeatedChars) {
    score += 20;
    flags.push("Repeated character pattern in address");
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { missingFields, city: addr.city, area: addr.area },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 5: PAYMENT BEHAVIOR
// ══════════════════════════════════════════════════════════════════════════════
async function checkPaymentBehavior(orderData) {
  const { customer, paymentMethod, total } = orderData;
  const flags = [];
  let score = 0;

  if (paymentMethod === "cash_on_delivery") {
    if (total > 10000) {
      score += 30;
      flags.push(`COD on very large order: ৳${total.toLocaleString()}`);
    } else if (total > 5000) {
      score += 15;
      flags.push(`COD on large order: ৳${total.toLocaleString()}`);
    }
  }

  let badHistory = 0;
  if (customer.phone) {
    badHistory = await Order.countDocuments({
      "customer.phone": customer.phone,
      orderStatus: { $in: ["cancelled", "returned"] },
      paymentMethod: "cash_on_delivery",
    });
    if (badHistory >= 3) {
      score += 40;
      flags.push(`Phone has ${badHistory} cancelled/returned COD orders`);
    } else if (badHistory >= 1) {
      score += 15;
      flags.push(
        `Phone has ${badHistory} previous cancelled/returned order(s)`,
      );
    }
  }

  let distinctMethods = [];
  if (customer.email) {
    distinctMethods = await Order.distinct("paymentMethod", {
      "customer.email": customer.email,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (distinctMethods.length >= 3) {
      score += 35;
      flags.push(
        `${distinctMethods.length} different payment methods from same email in 24h — card testing?`,
      );
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { paymentMethod, total, badHistory, distinctMethods },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 6: DEVICE FINGERPRINT
// ══════════════════════════════════════════════════════════════════════════════
function checkDeviceFingerprint(requestMeta = {}) {
  const userAgent = requestMeta.userAgent || "";
  const ipAddress = requestMeta.ipAddress || "unknown";
  const headers = requestMeta.headers || {};
  const flags = [];
  let score = 0;

  if (!userAgent) {
    score += 30;
    flags.push("Missing User-Agent header");
  } else {
    if (BOT_UA_PATTERNS.some((p) => p.test(userAgent))) {
      score += 45;
      flags.push(`Bot/automation User-Agent: ${userAgent.slice(0, 60)}`);
    }
    if (userAgent.length < 20) {
      score += 20;
      flags.push("Suspiciously short User-Agent");
    }
  }

  const missingBrowserHeaders = [
    !headers["accept"] && "Accept",
    !headers["accept-language"] && "Accept-Language",
    !headers["accept-encoding"] && "Accept-Encoding",
  ].filter(Boolean);

  if (missingBrowserHeaders.length >= 2) {
    score += 25;
    flags.push(`Missing browser headers: ${missingBrowserHeaders.join(", ")}`);
  }

  const fingerprintInput = `${userAgent}|${ipAddress}|${headers["accept-language"] || ""}`;
  const fingerprint = crypto
    .createHash("sha256")
    .update(fingerprintInput)
    .digest("hex")
    .slice(0, 16);

  return {
    score: Math.min(score, 100),
    flags,
    data: { userAgent: userAgent.slice(0, 100), ipAddress, fingerprint },
    fingerprint,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MASTER ANALYZER
// ══════════════════════════════════════════════════════════════════════════════
async function analyzeOrder(rawOrderData, requestMeta = {}) {
  const startTime = Date.now();

  // Normalize first — all signals receive clean data
  const orderData = normalizeOrderData(rawOrderData);

  console.log(
    `🛡️  [FRAUD] Analyzing order ${orderData.orderNumber || "UNKNOWN"} | items=${orderData.items.length} | total=${orderData.total}`,
  );

  const [velocityResult, paymentResult] = await Promise.all([
    checkVelocity(orderData).catch((err) => {
      console.error("⚠️ [FRAUD] velocity check failed:", err.message);
      return {
        score: 0,
        flags: [`Velocity check error: ${err.message}`],
        data: {},
      };
    }),
    checkPaymentBehavior(orderData).catch((err) => {
      console.error("⚠️ [FRAUD] payment check failed:", err.message);
      return {
        score: 0,
        flags: [`Payment check error: ${err.message}`],
        data: {},
      };
    }),
  ]);

  const orderPatternResult = checkOrderPattern(orderData);
  const customerResult = checkCustomerProfile(orderData);
  const addressResult = checkAddressRisk(orderData);
  const deviceResult = checkDeviceFingerprint(requestMeta);

  // Weighted composite score
  const rawScore =
    (velocityResult.score * WEIGHTS.velocity) / 100 +
    (orderPatternResult.score * WEIGHTS.orderPattern) / 100 +
    (customerResult.score * WEIGHTS.customerProfile) / 100 +
    (addressResult.score * WEIGHTS.addressRisk) / 100 +
    (paymentResult.score * WEIGHTS.paymentBehavior) / 100 +
    (deviceResult.score * WEIGHTS.deviceFingerprint) / 100;

  const riskScore = Math.round(Math.min(rawScore, 100));

  // Critical flag override
  const criticalFlags = [
    ...orderPatternResult.flags.filter((f) => f.includes("mismatch")),
    ...deviceResult.flags.filter((f) => f.includes("Bot")),
    ...customerResult.flags.filter((f) => f.includes("Disposable")),
  ];
  const hasCritical = criticalFlags.length > 0;
  const effectiveScore = hasCritical ? Math.max(riskScore, 65) : riskScore;

  // Verdict
  let verdict;
  if (effectiveScore <= THRESHOLDS.SAFE) verdict = "safe";
  else if (effectiveScore <= THRESHOLDS.REVIEW) verdict = "review";
  else verdict = "blocked";

  const allFlags = [
    ...velocityResult.flags,
    ...orderPatternResult.flags,
    ...customerResult.flags,
    ...addressResult.flags,
    ...paymentResult.flags,
    ...deviceResult.flags,
  ];

  const analysisTime = Date.now() - startTime;

  console.log(
    `🛡️  [FRAUD] ${orderData.orderNumber || "NEW"} | score=${effectiveScore} | verdict=${verdict} | flags=${allFlags.length} | ${analysisTime}ms`,
  );

  return {
    riskScore: effectiveScore,
    verdict,
    signals: {
      velocity: velocityResult,
      orderPattern: orderPatternResult,
      customerProfile: customerResult,
      addressRisk: addressResult,
      paymentBehavior: paymentResult,
      deviceFingerprint: deviceResult,
    },
    allFlags,
    fingerprint: deviceResult.fingerprint,
    analysisTime,
  };
}

// ── Save to DB ─────────────────────────────────────────────────────────────────
async function saveAnalysis(order, analysisResult, requestMeta = {}) {
  try {
    if (!order?._id) {
      console.error("❌ [FRAUD] saveAnalysis called with invalid order");
      return null;
    }
    const log = await FraudLog.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        orderNumber: order.orderNumber,
        riskScore: analysisResult.riskScore,
        verdict: analysisResult.verdict,
        signals: analysisResult.signals,
        allFlags: analysisResult.allFlags,
        fingerprint: analysisResult.fingerprint,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent?.slice(0, 200),
        autoAction: analysisResult.verdict === "blocked" ? "flagged" : "none",
      },
      { upsert: true, new: true, runValidators: true },
    );
    return log;
  } catch (err) {
    console.error("❌ [FRAUD] Failed to save analysis:", err.message);
    return null;
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { analyzeOrder, saveAnalysis, THRESHOLDS, WEIGHTS };
