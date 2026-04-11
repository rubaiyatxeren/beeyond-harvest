/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              BeeHarvest Fraud Detection Engine v1.0              ║
 * ║   Multi-signal scoring: 0 = clean, 100 = definite fraud          ║
 * ║                                                                   ║
 * ║  Signals:                                                         ║
 * ║  1. Velocity      — orders/minute, repeat attempts               ║
 * ║  2. Order Pattern — item combos, price manipulation, qty spikes  ║
 * ║  3. Customer      — name quality, email patterns, phone checks   ║
 * ║  4. Address Risk  — high-risk areas, incomplete addresses         ║
 * ║  5. Payment       — method + amount risk combinations            ║
 * ║  6. Device        — fingerprint, bot patterns, header anomalies  ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

const Order = require("../models/Order");
const FraudLog = require("../models/FraudLog");
const crypto = require("crypto");

// ─── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  SAFE: 30, // 0–30: safe, proceed
  REVIEW: 60, // 31–60: flag for manual review
  BLOCK: 60, // 61–100: auto-block
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

// ─── High-risk phone prefixes (VoIP / disposable) ─────────────────────────────
const SUSPICIOUS_PHONE_PREFIXES = ["016", "019"];

// ─── Disposable email domains ─────────────────────────────────────────────────
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

// ─── High-risk address keywords ───────────────────────────────────────────────
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

// ─── Known bot/scraper user-agent patterns ────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 1: VELOCITY CHECK
// Checks: orders from same phone/email in last N minutes/hours
// ══════════════════════════════════════════════════════════════════════════════
async function checkVelocity(orderData) {
  const { customer } = orderData;
  const now = new Date();
  const flags = [];
  let score = 0;

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
      Order.countDocuments({
        "customer.phone": customer.phone,
        createdAt: { $gte: since },
      }),
      Order.countDocuments({
        "customer.email": customer.email,
        createdAt: { $gte: since },
      }),
    ]);

    phoneCount[w.label] = byPhone;
    emailCount[w.label] = byEmail;

    if (byPhone > w.limit) {
      score += w.points;
      flags.push(`${byPhone} orders from same phone in last ${w.label}`);
    }
    if (byEmail > w.limit) {
      score += Math.round(w.points * 0.8); // slightly lower weight for email
      flags.push(`${byEmail} orders from same email in last ${w.label}`);
    }
  }

  // Check for multiple DIFFERENT phones with the same name in 1h
  const nameVariants = await Order.countDocuments({
    "customer.name": {
      $regex: new RegExp(`^${escapeRegex(customer.name)}$`, "i"),
    },
    "customer.phone": { $ne: customer.phone },
    createdAt: { $gte: new Date(now - 3600000) },
  });

  if (nameVariants > 2) {
    score += 25;
    flags.push(`Same name used with ${nameVariants} different phones in 1h`);
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { phoneCount, emailCount, nameVariants },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 2: ORDER PATTERN ANALYSIS
// Checks: unusually large orders, round prices, single-item bulk, item combos
// ══════════════════════════════════════════════════════════════════════════════
async function checkOrderPattern(orderData) {
  const items = orderData.items || [];
  const total = orderData.total || 0;
  const subtotal = orderData.subtotal || 0;
  const deliveryCharge = orderData.deliveryCharge || 0;
  const discount = orderData.discount || 0;

  const flags = [];
  let score = 0;

  // Huge single order
  if (total > 50000) {
    score += 30;
    flags.push(`Very high order value: ৳${total.toLocaleString()}`);
  } else if (total > 20000) {
    score += 15;
    flags.push(`High order value: ৳${total.toLocaleString()}`);
  }

  // Excessive quantity on a single item
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

  // Max items in a single order
  if (items.length > 15) {
    score += 20;
    flags.push(`Suspiciously many distinct items: ${items.length}`);
  }

  // Discount manipulation: discount >= 80% of subtotal
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

  // Delivery charge manipulation (negative or zero on large order)
  if (deliveryCharge === 0 && total > 1000) {
    score += 10;
    flags.push("Free delivery on large order — verify coupon legitimacy");
  }

  // Price total mismatch check (recalculate)
  const expectedSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const reportedSubtotal = subtotal;
  if (Math.abs(expectedSubtotal - reportedSubtotal) > 1) {
    score += 40;
    flags.push(
      `Subtotal mismatch: expected ৳${expectedSubtotal} got ৳${reportedSubtotal}`,
    );
  }

  const expectedTotal = Math.max(
    0,
    expectedSubtotal + deliveryCharge - discount,
  );
  if (Math.abs(expectedTotal - total) > 1) {
    score += 40;
    flags.push(`Total mismatch: expected ৳${expectedTotal} got ৳${total}`);
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { total, itemCount: items.length, discount },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 3: CUSTOMER PROFILE ANALYSIS
// Checks: name quality, email patterns, phone format, profile consistency
// ══════════════════════════════════════════════════════════════════════════════
function checkCustomerProfile(orderData) {
  const { customer } = orderData;
  const flags = [];
  let score = 0;

  const { name, email, phone } = customer;

  // ── Name checks ────────────────────────────────────────────────────────────
  if (!name || name.trim().length < 3) {
    score += 20;
    flags.push("Name too short or missing");
  }
  // Only digits/special chars in name
  if (name && /^[\d\s\W]+$/.test(name)) {
    score += 30;
    flags.push("Name contains only numbers or special characters");
  }
  // Keyboard mash patterns
  if (name && /(.)\1{3,}/.test(name)) {
    score += 20;
    flags.push("Repeated character pattern in name");
  }
  // Consecutive keyboard chars
  if (name && /(qwerty|asdf|zxcv|1234|abcd)/i.test(name)) {
    score += 25;
    flags.push("Keyboard pattern detected in name");
  }

  // ── Email checks ───────────────────────────────────────────────────────────
  const emailDomain = email ? email.split("@")[1]?.toLowerCase() : null;

  if (!email || !email.includes("@")) {
    score += 25;
    flags.push("Invalid email format");
  } else if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 40;
    flags.push(`Disposable email domain: ${emailDomain}`);
  }

  // Email looks auto-generated: random chars before @
  if (email) {
    const localPart = email.split("@")[0];
    // e.g. "xjf93k28@..." — more than 8 chars, mostly random
    if (/^[a-z0-9]{8,}$/.test(localPart) && !/[aeiou]{2,}/.test(localPart)) {
      score += 15;
      flags.push("Email local part looks auto-generated");
    }
    // Sequential numbers: test123, user456
    if (/test\d+|user\d+|demo\d+|fake\d+/i.test(localPart)) {
      score += 20;
      flags.push("Generic test/fake email pattern");
    }
  }

  // ── Phone checks ───────────────────────────────────────────────────────────
  if (!phone) {
    score += 30;
    flags.push("Missing phone number");
  } else {
    const cleanPhone = phone.replace(/\D/g, "");

    // Must be 11 digits for Bangladesh
    if (cleanPhone.length !== 11) {
      score += 25;
      flags.push(`Invalid phone length: ${cleanPhone.length} digits`);
    }

    // All same digit: 01111111111
    if (/^(\d)\1+$/.test(cleanPhone)) {
      score += 40;
      flags.push("Phone number is all same digit");
    }

    // Sequential: 01234567890
    if (/01234567890|09876543210/.test(cleanPhone)) {
      score += 35;
      flags.push("Sequential phone number detected");
    }

    // Suspicious prefix
    // Note: This is contextual — adjust based on your actual business data
    if (SUSPICIOUS_PHONE_PREFIXES.some((p) => cleanPhone.startsWith(p))) {
      score += 5; // low weight — just a soft signal
      flags.push(
        `Phone prefix flagged (soft signal): ${cleanPhone.slice(0, 3)}`,
      );
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { emailDomain, phoneLength: phone?.replace(/\D/g, "").length },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 4: ADDRESS RISK
// Checks: missing fields, keyword patterns, inconsistency
// ══════════════════════════════════════════════════════════════════════════════
function checkAddressRisk(orderData) {
  const { customer } = orderData;
  const addr = customer.address || {};
  const flags = [];
  let score = 0;

  const requiredFields = ["street", "area", "city"];
  const missingFields = requiredFields.filter(
    (f) => !addr[f] || addr[f].trim() === "",
  );

  if (missingFields.length === requiredFields.length) {
    score += 35;
    flags.push("Completely missing delivery address");
  } else if (missingFields.length > 0) {
    score += missingFields.length * 10;
    flags.push(`Missing address fields: ${missingFields.join(", ")}`);
  }

  // Check for suspicious keywords in any address field
  const addressText = Object.values(addr).join(" ").toLowerCase();
  const badKeywords = HIGH_RISK_AREA_KEYWORDS.filter((k) =>
    addressText.includes(k),
  );
  if (badKeywords.length > 0) {
    score += badKeywords.length * 15;
    flags.push(`Suspicious address content: ${badKeywords.join(", ")}`);
  }

  // Very short address fields
  if (addr.street && addr.street.trim().length < 5) {
    score += 10;
    flags.push("Street address suspiciously short");
  }

  // Repeated character pattern in address
  if (Object.values(addr).some((v) => v && /(.)\1{3,}/.test(v))) {
    score += 20;
    flags.push("Repeated character pattern in address");
  }

  return { score: Math.min(score, 100), flags, data: { missingFields, addr } };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 5: PAYMENT BEHAVIOR
// Checks: method + amount risk combos, COD on very large orders
// ══════════════════════════════════════════════════════════════════════════════
async function checkPaymentBehavior(orderData) {
  const { customer, paymentMethod, total } = orderData;
  const flags = [];
  let score = 0;

  // COD on very large orders — high fraud/non-delivery risk
  if (paymentMethod === "cash_on_delivery") {
    if (total > 10000) {
      score += 30;
      flags.push(`COD on very large order: ৳${total.toLocaleString()}`);
    } else if (total > 5000) {
      score += 15;
      flags.push(`COD on large order: ৳${total.toLocaleString()}`);
    }
  }

  // Check if same phone has multiple cancelled/returned COD orders (serial offender)
  const badHistory = await Order.countDocuments({
    "customer.phone": customer.phone,
    orderStatus: { $in: ["cancelled", "returned"] },
    paymentMethod: "cash_on_delivery",
  });

  if (badHistory >= 3) {
    score += 40;
    flags.push(`Phone has ${badHistory} cancelled/returned COD orders`);
  } else if (badHistory >= 1) {
    score += 15;
    flags.push(`Phone has ${badHistory} previous cancelled/returned order(s)`);
  }

  // Same email, multiple payment methods (card-testing behavior)
  const distinctMethods = await Order.distinct("paymentMethod", {
    "customer.email": customer.email,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (distinctMethods.length >= 3) {
    score += 35;
    flags.push(
      `${distinctMethods.length} different payment methods from same email in 24h — card testing?`,
    );
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { paymentMethod, total, badHistory, distinctMethods },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 6: DEVICE FINGERPRINT
// Checks: bot UA, missing headers, suspicious request patterns
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
    const isBot = BOT_UA_PATTERNS.some((p) => p.test(userAgent));
    if (isBot) {
      score += 45;
      flags.push(`Bot/automation User-Agent: ${userAgent.slice(0, 60)}`);
    }
    if (userAgent.length < 20) {
      score += 20;
      flags.push("Suspiciously short User-Agent");
    }
  }

  const hasAccept = !!headers["accept"];
  const hasAcceptLang = !!headers["accept-language"];
  const hasAcceptEncoding = !!headers["accept-encoding"];

  const missingBrowserHeaders = [
    !hasAccept && "Accept",
    !hasAcceptLang && "Accept-Language",
    !hasAcceptEncoding && "Accept-Encoding",
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
// MASTER ANALYZER — orchestrates all signals and computes weighted score
// ══════════════════════════════════════════════════════════════════════════════
async function analyzeOrder(orderData, requestMeta = {}) {
  const startTime = Date.now();

  // Run all signals (some in parallel, some sequential)
  const [velocityResult, paymentResult] = await Promise.all([
    checkVelocity(orderData),
    checkPaymentBehavior(orderData),
  ]);

  const orderPatternResult = checkOrderPattern(orderData);
  const customerResult = checkCustomerProfile(orderData);
  const addressResult = checkAddressRisk(orderData);
  const deviceResult = checkDeviceFingerprint(requestMeta);

  // ── Weighted composite score ────────────────────────────────────────────────
  const rawScore =
    (velocityResult.score * WEIGHTS.velocity) / 100 +
    (orderPatternResult.score * WEIGHTS.orderPattern) / 100 +
    (customerResult.score * WEIGHTS.customerProfile) / 100 +
    (addressResult.score * WEIGHTS.addressRisk) / 100 +
    (paymentResult.score * WEIGHTS.paymentBehavior) / 100 +
    (deviceResult.score * WEIGHTS.deviceFingerprint) / 100;

  const riskScore = Math.round(Math.min(rawScore, 100));

  // ── Critical flag override (instant block regardless of score) ─────────────
  const criticalFlags = [
    ...orderPatternResult.flags.filter((f) => f.includes("mismatch")),
    ...deviceResult.flags.filter((f) => f.includes("Bot")),
    ...customerResult.flags.filter((f) => f.includes("Disposable")),
  ];

  const hasCritical = criticalFlags.length > 0;
  const effectiveScore = hasCritical ? Math.max(riskScore, 65) : riskScore;

  // ── Verdict ─────────────────────────────────────────────────────────────────
  let verdict;
  if (effectiveScore <= THRESHOLDS.SAFE) {
    verdict = "safe";
  } else if (effectiveScore <= THRESHOLDS.REVIEW) {
    verdict = "review";
  } else {
    verdict = "blocked";
  }

  // ── Collect all flags ───────────────────────────────────────────────────────
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

// ── Save analysis result to DB ────────────────────────────────────────────────
async function saveAnalysis(order, analysisResult, requestMeta = {}) {
  try {
    // Ensure we have order._id
    if (!order || !order._id) {
      console.error("❌ [FRAUD] Invalid order for saveAnalysis");
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
    console.error("❌ [FRAUD] Failed to save analysis:", err);
    console.error("❌ Stack:", err.stack);
    return null;
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  analyzeOrder,
  saveAnalysis,
  THRESHOLDS,
  WEIGHTS,
};
