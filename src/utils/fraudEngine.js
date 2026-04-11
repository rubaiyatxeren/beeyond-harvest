/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              BeeHarvest Fraud Detection Engine v2.0              ║
 * ║   Production-grade — Bangladesh-optimized fraud prevention       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

const Order = require("../models/Order");
const FraudLog = require("../models/FraudLog");
const crypto = require("crypto");

// ─── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  SAFE: 25,
  REVIEW: 55,
  BLOCK: 55,
};

// ─── Signal Weights ────────────────────────────────────────────────────────────
const WEIGHTS = {
  velocity: 25,
  orderPattern: 20,
  customerProfile: 20,
  addressRisk: 15,
  paymentBehavior: 12,
  deviceFingerprint: 8,
};

// ─── Bangladesh valid carrier prefixes (all legitimate) ───────────────────────
const BD_VALID_PREFIXES = ["013", "014", "015", "016", "017", "018", "019"];

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
  "throwaway.email",
  "mailnesia.com",
  "mailforspam.com",
  "spamgourmet.org",
  "trashmail.me",
  "getairmail.com",
  "filzmail.com",
  "throwam.com",
  "spamfree24.org",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "discardmail.com",
  "discardmail.de",
  "spamgourmet.com",
  "tempemail.net",
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
  "sample",
  "example",
  "none",
  "nil",
  "void",
  "random",
  "dummy",
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
  /scrapy/i,
  /httpie/i,
  /node-fetch/i,
  /got\//i,
  /superagent/i,
  /okhttp/i,
  /apache-httpclient/i,
  /php\/\d/i,
  /ruby/i,
  /perl/i,
];

// ─── Normalize ────────────────────────────────────────────────────────────────
function normalizeOrderData(orderData) {
  const o = { ...orderData };
  if (!o.customer || typeof o.customer !== "object") o.customer = {};
  o.customer.name = (o.customer.name || "").trim();
  o.customer.email = (o.customer.email || "").trim().toLowerCase();
  o.customer.phone = (o.customer.phone || "").trim();
  if (!o.customer.address || typeof o.customer.address !== "object") {
    o.customer.address = {};
  }
  o.items = Array.isArray(o.items) ? o.items : [];
  o.total = Number(o.total) || 0;
  o.subtotal = Number(o.subtotal) || 0;
  o.deliveryCharge = Number(o.deliveryCharge) || 0;
  o.discount = Number(o.discount) || 0;
  o.paymentMethod = o.paymentMethod || "";
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
// SIGNAL 1: VELOCITY CHECK (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
async function checkVelocity(orderData) {
  const { customer } = orderData;
  const now = new Date();
  const flags = [];
  let score = 0;

  if (!customer.phone && !customer.email) {
    return {
      score: 0,
      flags: ["No phone or email — velocity check skipped"],
      data: {},
    };
  }

  const windows = [
    { label: "1min", ms: 1 * 60 * 1000, limit: 1, points: 50 },
    { label: "5min", ms: 5 * 60 * 1000, limit: 2, points: 35 },
    { label: "1hour", ms: 60 * 60 * 1000, limit: 4, points: 25 },
    { label: "6hr", ms: 6 * 60 * 60 * 1000, limit: 6, points: 15 },
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

  // Same name, different phones
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
        score += 30;
        flags.push(
          `Same name used with ${nameVariants} different phones in 1h`,
        );
      } else if (nameVariants === 2) {
        score += 15;
        flags.push(
          `Same name used with ${nameVariants} different phones in 1h`,
        );
      }
    } catch (err) {
      console.warn("⚠️ [FRAUD] nameVariants query failed:", err.message);
    }
  }

  // Same address, different customers (address reuse)
  const street = orderData.customer?.address?.street;
  if (street && street.length > 5) {
    try {
      const addressReuse = await Order.countDocuments({
        "customer.address.street": {
          $regex: new RegExp(escapeRegex(street), "i"),
        },
        "customer.phone": { $ne: customer.phone },
        createdAt: { $gte: new Date(now - 24 * 3600000) },
      });
      if (addressReuse >= 3) {
        score += 20;
        flags.push(
          `Same delivery address used by ${addressReuse} different customers in 24h`,
        );
      }
    } catch (err) {
      console.warn("⚠️ [FRAUD] addressReuse query failed:", err.message);
    }
  }

  // IP-based velocity (if IP available in order)
  return {
    score: Math.min(score, 100),
    flags,
    data: { phoneCount, emailCount, nameVariants },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 2: ORDER PATTERN ANALYSIS (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
function checkOrderPattern(orderData) {
  const { items, total, subtotal, deliveryCharge, discount } = orderData;
  const flags = [];
  let score = 0;

  // High value checks
  if (total > 100000) {
    score += 45;
    flags.push(`Extremely high order value: ৳${total.toLocaleString()}`);
  } else if (total > 50000) {
    score += 30;
    flags.push(`Very high order value: ৳${total.toLocaleString()}`);
  } else if (total > 20000) {
    score += 15;
    flags.push(`High order value: ৳${total.toLocaleString()}`);
  }

  // Suspicious round number (e.g. exactly 10000, 20000 — often fake)
  if (total > 1000 && total % 1000 === 0 && items.length <= 2) {
    score += 8;
    flags.push(`Suspiciously round order total: ৳${total.toLocaleString()}`);
  }

  // Bulk quantity
  const highQtyItems = items.filter((i) => i.quantity > 20);
  if (highQtyItems.length > 0) {
    score += 30;
    flags.push(
      `Bulk quantity: ${highQtyItems.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`,
    );
  } else if (items.some((i) => i.quantity > 10)) {
    score += 15;
    flags.push("Unusually high item quantity (>10)");
  } else if (items.some((i) => i.quantity > 5)) {
    score += 5;
    flags.push("High item quantity (>5) — soft signal");
  }

  // Too many distinct items
  if (items.length > 15) {
    score += 25;
    flags.push(`Suspiciously many distinct items: ${items.length}`);
  } else if (items.length > 10) {
    score += 10;
    flags.push(`Many distinct items: ${items.length}`);
  }

  // Discount ratio checks
  if (discount > 0 && subtotal > 0) {
    const discountRatio = discount / subtotal;
    if (discountRatio >= 0.9) {
      score += 50;
      flags.push(
        `Near-full discount: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    } else if (discountRatio >= 0.8) {
      score += 35;
      flags.push(
        `Extreme discount ratio: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    } else if (discountRatio >= 0.5) {
      score += 15;
      flags.push(
        `High discount ratio: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    } else if (discountRatio >= 0.3) {
      score += 5;
      flags.push(
        `Moderate discount: ${Math.round(discountRatio * 100)}% of subtotal`,
      );
    }
  }

  // Unusually large discount absolute value
  if (discount > 5000) {
    score += 20;
    flags.push(`Large absolute discount: ৳${discount.toLocaleString()}`);
  }

  // Free delivery on large order
  if (deliveryCharge === 0 && total > 1000) {
    score += 10;
    flags.push("Free delivery on large order — verify coupon legitimacy");
  }

  // Zero price items (potential price manipulation)
  const zeroPriceItems = items.filter((i) => i.price === 0 && i.quantity > 0);
  if (zeroPriceItems.length > 0) {
    score += 35;
    flags.push(
      `${zeroPriceItems.length} item(s) with zero price — potential price manipulation`,
    );
  }

  // Price recalculation mismatch
  const itemsWithPrices = items.filter((i) => i.price > 0 && i.quantity > 0);
  if (itemsWithPrices.length > 0) {
    const expectedSubtotal = itemsWithPrices.reduce(
      (s, i) => s + i.price * i.quantity,
      0,
    );

    if (subtotal > 0 && Math.abs(expectedSubtotal - subtotal) > 5) {
      score += 45;
      flags.push(
        `Subtotal mismatch: expected ৳${expectedSubtotal.toFixed(0)} got ৳${subtotal}`,
      );
    }

    const expectedTotal = Math.max(
      0,
      expectedSubtotal + deliveryCharge - discount,
    );
    if (total > 0 && Math.abs(expectedTotal - total) > 5) {
      score += 45;
      flags.push(
        `Total mismatch: expected ৳${expectedTotal.toFixed(0)} got ৳${total}`,
      );
    }

    // Item-level total mismatch
    const itemTotalMismatches = items.filter(
      (i) =>
        i.price > 0 &&
        i.total > 0 &&
        Math.abs(i.price * i.quantity - i.total) > 2,
    );
    if (itemTotalMismatches.length > 0) {
      score += 25;
      flags.push(
        `${itemTotalMismatches.length} item(s) have incorrect line totals`,
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
// SIGNAL 3: CUSTOMER PROFILE ANALYSIS (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
function checkCustomerProfile(orderData) {
  const { customer } = orderData;
  const { name, email, phone } = customer;
  const flags = [];
  let score = 0;

  // ── Name checks ──────────────────────────────────────────────────────────────
  if (!name || name.length < 2) {
    score += 25;
    flags.push("Name too short or missing");
  } else if (name.length < 3) {
    score += 10;
    flags.push("Name suspiciously short");
  }

  if (name && /^[\d\s\W]+$/.test(name)) {
    score += 35;
    flags.push("Name contains only numbers or special characters");
  }

  if (name && /(.)\1{3,}/.test(name)) {
    score += 25;
    flags.push("Repeated character pattern in name");
  }

  if (
    name &&
    /(qwerty|asdf|zxcv|1234|abcd|test|fake|dummy|admin|user)/i.test(name)
  ) {
    score += 30;
    flags.push("Keyboard/test pattern detected in name");
  }

  // Single word name with no spaces (weak signal for BD)
  if (name && !name.includes(" ") && name.length < 5) {
    score += 8;
    flags.push("Very short single-word name");
  }

  // Name is just digits
  if (name && /^\d+$/.test(name.trim())) {
    score += 40;
    flags.push("Name is entirely numeric");
  }

  // ── Email checks ─────────────────────────────────────────────────────────────
  const emailDomain = email ? email.split("@")[1]?.toLowerCase() : null;

  if (!email || !email.includes("@") || !email.includes(".")) {
    score += 30;
    flags.push("Invalid or missing email format");
  } else if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 50;
    flags.push(`Disposable email domain: ${emailDomain}`);
  }

  if (email) {
    const localPart = email.split("@")[0];

    // Auto-generated pattern (long random string, no vowels)
    if (/^[a-z0-9]{10,}$/.test(localPart) && !/[aeiou]{2,}/.test(localPart)) {
      score += 18;
      flags.push("Email local part looks auto-generated");
    }

    // Test/fake patterns
    if (
      /^(test|fake|demo|sample|user|admin|noreply|null|void)\d*/i.test(
        localPart,
      )
    ) {
      score += 25;
      flags.push("Generic test/fake email pattern");
    }

    // Email matches loadtest pattern
    if (email.includes("@loadtest.com") || email.includes("+loadtest")) {
      score += 60;
      flags.push("Load test email detected");
    }

    // Suspicious email — name doesn't match email at all
    if (name && name.length > 3) {
      const nameParts = name
        .toLowerCase()
        .split(" ")
        .filter((p) => p.length > 2);
      const emailHasName = nameParts.some((part) => localPart.includes(part));
      // Only flag if the local part is completely random-looking
      if (!emailHasName && /^[a-z]{2,4}\d{4,}/.test(localPart)) {
        score += 10;
        flags.push("Email pattern doesn't match customer name");
      }
    }
  }

  // ── Phone checks ─────────────────────────────────────────────────────────────
  if (!phone) {
    score += 35;
    flags.push("Missing phone number");
  } else {
    const cleanPhone = phone.replace(/\D/g, "");

    // Bangladesh phones must be exactly 11 digits starting with 01
    if (cleanPhone.length !== 11) {
      score += 30;
      flags.push(
        `Invalid phone length: ${cleanPhone.length} digits (expected 11)`,
      );
    } else if (!cleanPhone.startsWith("01")) {
      score += 35;
      flags.push("Phone doesn't start with 01 — not a valid BD number");
    } else {
      // Check valid BD carrier prefix
      const prefix3 = cleanPhone.slice(0, 3);
      if (!BD_VALID_PREFIXES.includes(prefix3)) {
        score += 30;
        flags.push(`Invalid BD carrier prefix: ${prefix3}`);
      }
    }

    // All same digit
    if (/^(\d)\1+$/.test(cleanPhone)) {
      score += 50;
      flags.push("Phone number is all same digit");
    }

    // Sequential
    if (/01234567890|09876543210/.test(cleanPhone)) {
      score += 40;
      flags.push("Sequential phone number detected");
    }

    // Repeated pattern (e.g. 01711711711)
    if (/^(\d{3,4})\1+/.test(cleanPhone.slice(2))) {
      score += 20;
      flags.push("Repeating digit pattern in phone number");
    }

    // Known test numbers
    const testNumbers = [
      "01700000000",
      "01800000000",
      "01900000000",
      "01111111111",
      "01999999999",
    ];
    if (testNumbers.includes(cleanPhone)) {
      score += 55;
      flags.push("Known test phone number detected");
    }
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { emailDomain, phoneLength: phone?.replace(/\D/g, "").length || 0 },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 4: ADDRESS RISK (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
function checkAddressRisk(orderData) {
  const addr = orderData.customer.address || {};
  const flags = [];
  let score = 0;

  const requiredFields = ["street", "city"];
  const missingFields = requiredFields.filter(
    (f) => !addr[f] || String(addr[f]).trim() === "",
  );

  if (missingFields.length === requiredFields.length) {
    score += 40;
    flags.push("Completely missing delivery address");
  } else if (missingFields.length > 0) {
    score += missingFields.length * 12;
    flags.push(`Missing address fields: ${missingFields.join(", ")}`);
  }

  // Check all address values for suspicious keywords
  const addressText = Object.values(addr)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const badKeywords = HIGH_RISK_AREA_KEYWORDS.filter((k) =>
    addressText.includes(k),
  );
  if (badKeywords.length > 0) {
    score += Math.min(badKeywords.length * 18, 54);
    flags.push(`Suspicious address content: ${badKeywords.join(", ")}`);
  }

  // Short street address
  if (addr.street) {
    const streetLen = String(addr.street).trim().length;
    if (streetLen < 3) {
      score += 20;
      flags.push("Street address critically short");
    } else if (streetLen < 6) {
      score += 10;
      flags.push("Street address suspiciously short");
    }
  }

  // Repeated chars in address fields
  const hasRepeatedChars = Object.values(addr).some(
    (v) => v && /(.)\1{3,}/.test(String(v)),
  );
  if (hasRepeatedChars) {
    score += 22;
    flags.push("Repeated character pattern in address");
  }

  // Address is just numbers
  if (addr.street && /^\d+$/.test(String(addr.street).trim())) {
    score += 25;
    flags.push("Street address is entirely numeric");
  }

  // City check — must be a real-ish value
  if (addr.city) {
    const city = String(addr.city).trim().toLowerCase();
    if (city.length < 3) {
      score += 15;
      flags.push("City name too short");
    }
    if (/^\d+$/.test(city)) {
      score += 20;
      flags.push("City field contains only numbers");
    }
  }

  // Check if street === city (copy-paste error or fake)
  if (
    addr.street &&
    addr.city &&
    String(addr.street).trim().toLowerCase() ===
      String(addr.city).trim().toLowerCase()
  ) {
    score += 15;
    flags.push("Street and city fields are identical");
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { missingFields, city: addr.city, area: addr.area },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 5: PAYMENT BEHAVIOR (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
async function checkPaymentBehavior(orderData) {
  const { customer, paymentMethod, total } = orderData;
  const flags = [];
  let score = 0;

  // COD risk scaling
  if (paymentMethod === "cash_on_delivery") {
    if (total > 50000) {
      score += 45;
      flags.push(`COD on extremely large order: ৳${total.toLocaleString()}`);
    } else if (total > 20000) {
      score += 35;
      flags.push(`COD on very large order: ৳${total.toLocaleString()}`);
    } else if (total > 10000) {
      score += 20;
      flags.push(`COD on large order: ৳${total.toLocaleString()}`);
    } else if (total > 5000) {
      score += 10;
      flags.push(`COD on medium-large order: ৳${total.toLocaleString()}`);
    }
  }

  // Bad order history by phone
  let badHistory = 0;
  let totalOrdersByPhone = 0;
  if (customer.phone) {
    const [cancelled, totalOrders] = await Promise.all([
      Order.countDocuments({
        "customer.phone": customer.phone,
        orderStatus: { $in: ["cancelled", "returned"] },
      }),
      Order.countDocuments({ "customer.phone": customer.phone }),
    ]);
    badHistory = cancelled;
    totalOrdersByPhone = totalOrders;

    if (badHistory >= 5) {
      score += 55;
      flags.push(
        `Phone has ${badHistory} cancelled/returned orders — high risk history`,
      );
    } else if (badHistory >= 3) {
      score += 40;
      flags.push(`Phone has ${badHistory} cancelled/returned orders`);
    } else if (badHistory >= 1) {
      score += 15;
      flags.push(
        `Phone has ${badHistory} previous cancelled/returned order(s)`,
      );
    }

    // High cancellation rate
    if (totalOrdersByPhone >= 3 && badHistory / totalOrdersByPhone >= 0.6) {
      score += 25;
      flags.push(
        `High cancellation rate: ${Math.round((badHistory / totalOrdersByPhone) * 100)}% of orders cancelled`,
      );
    }
  }

  // Bad order history by email
  let badHistoryEmail = 0;
  if (customer.email) {
    badHistoryEmail = await Order.countDocuments({
      "customer.email": customer.email,
      orderStatus: { $in: ["cancelled", "returned"] },
    });
    if (badHistoryEmail >= 3 && badHistoryEmail > badHistory) {
      score += 25;
      flags.push(`Email has ${badHistoryEmail} cancelled/returned orders`);
    }
  }

  // Multiple payment methods (card testing)
  let distinctMethods = [];
  if (customer.email) {
    distinctMethods = await Order.distinct("paymentMethod", {
      "customer.email": customer.email,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (distinctMethods.length >= 3) {
      score += 40;
      flags.push(
        `${distinctMethods.length} different payment methods from same email in 24h — card testing?`,
      );
    } else if (distinctMethods.length === 2) {
      score += 10;
      flags.push(`2 different payment methods from same email in 24h`);
    }
  }

  // First order with very high COD value (no purchase history = higher risk)
  if (
    paymentMethod === "cash_on_delivery" &&
    total > 3000 &&
    totalOrdersByPhone === 0
  ) {
    score += 12;
    flags.push("First-time customer with high-value COD order");
  }

  return {
    score: Math.min(score, 100),
    flags,
    data: { paymentMethod, total, badHistory, distinctMethods },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL 6: DEVICE FINGERPRINT (enhanced)
// ══════════════════════════════════════════════════════════════════════════════
function checkDeviceFingerprint(requestMeta = {}) {
  const userAgent = requestMeta.userAgent || "";
  const ipAddress = requestMeta.ipAddress || "unknown";
  const headers = requestMeta.headers || {};
  const flags = [];
  let score = 0;

  if (!userAgent) {
    score += 35;
    flags.push("Missing User-Agent header");
  } else {
    if (BOT_UA_PATTERNS.some((p) => p.test(userAgent))) {
      score += 50;
      flags.push(`Bot/automation User-Agent: ${userAgent.slice(0, 60)}`);
    }

    if (userAgent.length < 20) {
      score += 25;
      flags.push("Suspiciously short User-Agent");
    } else if (userAgent.length < 40) {
      score += 10;
      flags.push("Unusually short User-Agent");
    }

    // Headless browser detection
    if (/HeadlessChrome|PhantomJS|Electron|Nightmare/i.test(userAgent)) {
      score += 55;
      flags.push("Headless browser detected");
    }

    // Old/outdated browser (potential scraper)
    if (/MSIE [1-8]\.|Trident\/[1-6]\./i.test(userAgent)) {
      score += 20;
      flags.push("Extremely outdated browser version");
    }
  }

  // Missing standard browser headers
  const missingBrowserHeaders = [
    !headers["accept"] && "Accept",
    !headers["accept-language"] && "Accept-Language",
    !headers["accept-encoding"] && "Accept-Encoding",
  ].filter(Boolean);

  if (missingBrowserHeaders.length >= 2) {
    score += 30;
    flags.push(`Missing browser headers: ${missingBrowserHeaders.join(", ")}`);
  } else if (missingBrowserHeaders.length === 1) {
    score += 10;
    flags.push(`Missing browser header: ${missingBrowserHeaders[0]}`);
  }

  // Suspicious IP patterns
  if (ipAddress !== "unknown") {
    // Check for common datacenter/proxy IP patterns (Tor exit, AWS, etc.)
    // Very basic check — can be enhanced with a GeoIP library
    if (ipAddress === "127.0.0.1" || ipAddress === "::1") {
      score += 15;
      flags.push("Localhost IP address — likely internal test");
    }

    // Multiple different IPs for same device fingerprint context
    // (basic check — full implementation needs Redis or DB)
  }

  // Content-Type anomaly — if order came without proper content type
  if (
    headers["content-type"] &&
    !headers["content-type"].includes("application/json")
  ) {
    score += 15;
    flags.push("Unusual Content-Type header for API request");
  }

  // No referer header at all (direct API hit, not from browser)
  if (!headers["referer"] && !headers["origin"]) {
    score += 8;
    flags.push("No referer or origin header — possible direct API access");
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

  // ── Critical flag overrides ──────────────────────────────────────────────────
  const criticalFlags = [
    ...orderPatternResult.flags.filter(
      (f) =>
        f.includes("mismatch") ||
        f.includes("zero price") ||
        f.includes("manipulation"),
    ),
    ...deviceResult.flags.filter(
      (f) => f.includes("Bot") || f.includes("Headless"),
    ),
    ...customerResult.flags.filter(
      (f) =>
        f.includes("Disposable") ||
        f.includes("Load test") ||
        f.includes("all same digit"),
    ),
    ...velocityResult.flags.filter((f) => f.includes("1min")),
    ...paymentResult.flags.filter(
      (f) => f.includes("high risk history") || f.includes("card testing"),
    ),
  ];

  const hasCritical = criticalFlags.length > 0;

  // Multiple critical flags = higher floor score
  let effectiveScore = riskScore;
  if (criticalFlags.length >= 3) {
    effectiveScore = Math.max(riskScore, 80);
  } else if (criticalFlags.length >= 2) {
    effectiveScore = Math.max(riskScore, 70);
  } else if (hasCritical) {
    effectiveScore = Math.max(riskScore, 60);
  }

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
    `🛡️  [FRAUD] ${orderData.orderNumber || "NEW"} | score=${effectiveScore} | verdict=${verdict} | flags=${allFlags.length} | critical=${criticalFlags.length} | ${analysisTime}ms`,
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
    criticalFlags,
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
