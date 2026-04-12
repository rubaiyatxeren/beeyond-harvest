const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { errorHandler } = require("./middleware/errorMiddleware");

// ✅ IMPORT ROUTES
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const deliveryChargeRoutes = require("./routes/deliveryChargeRoutes");
const couponRoutes = require("./routes/couponRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const fraudRoutes = require("./routes/fraudRoutes");
const profitRoutes = require("./routes/profitRoutes");

const app = express();

// ✅ TRUST PROXY (Render / Nginx)
app.set("trust proxy", 1);

// ✅ SECURITY
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

// ✅ CORS CONFIG
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5502",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5502",
  "http://192.168.56.1:3000",
  "http://192.168.56.1:3001",
  "http://192.168.56.1:5500",
  "http://192.168.56.1:5501",
  "https://admin-beeharvest.vercel.app",
  "https://beeharvest.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV === "development") return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("⚠️ Blocked CORS origin:", origin);
      return callback(null, true); // allow but log
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Authorization"],
    maxAge: 86400,
  }),
);

// ✅ BODY PARSER
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ LOGGING (dev only)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Rate Limit Helpers ────────────────────────────────────────────────────────

/**
 * Extract a stable IP key from the request.
 * Strips IPv6 prefix so ::ffff:1.2.3.4 → 1.2.3.4, preventing double-counting.
 */
function getIpKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  let ip = forwarded ? forwarded.split(",")[0].trim() : req.ip || "";
  // Normalise ::ffff: mapped IPv4 addresses
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip || "unknown";
}

/**
 * Returns true when the request carries a valid-looking admin JWT.
 * We do NOT verify the signature here (that happens in authMiddleware).
 * We just check the presence so rate-limiting skips the request early.
 * The real auth gate still runs on every protected route.
 */
function isAdminRequest(req) {
  const auth = req.headers["authorization"] || "";
  // Bearer tokens issued by this app are always JWTs (3 base64 segments)
  if (!auth.startsWith("Bearer ")) return false;
  const parts = auth.slice(7).split(".");
  return parts.length === 3;
}

// ─── Public rate limiter — 100 req / 10 min per IP ────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  // Skip the limit entirely for authenticated admin requests
  skip: (req) => isAdminRequest(req),
});

// ─── Admin rate limiter — 1 000 req / 10 min per IP ──────────────────────────
// Acts as a safety net so even admins can't accidentally DoS the server.
const adminLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  message: "Admin rate limit reached. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  // Only apply to requests that carry a Bearer token
  skip: (req) => !isAdminRequest(req),
});

// Apply both limiters to all /api routes.
// publicLimiter skips authenticated requests; adminLimiter skips unauthenticated ones.
// Result: public callers → 100/10 min, admins → 1 000/10 min.
app.use("/api", publicLimiter);
app.use("/api", adminLimiter);

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/delivery-charges", deliveryChargeRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/fraud", fraudRoutes);
app.use("/api/profit", profitRoutes);

// ✅ DEBUG ROUTE LIST
console.log("✅ Routes registered:");
[
  "/api/auth",
  "/api/categories",
  "/api/products",
  "/api/banners",
  "/api/orders",
  "/api/dashboard",
  "/api/delivery-charges",
  "/api/coupons",
  "/api/chatbot",
  "/api/fraud",
  "/api/profit",
].forEach((route) => console.log("  -", route));

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const isConnected = dbState === 1;
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "OK" : "DEGRADED",
    message: isConnected ? "Server is running" : "Database not connected",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    database: {
      status: dbStatusMap[dbState] || "unknown",
      host: mongoose.connection.host || "not connected",
      name: mongoose.connection.name || "not connected",
    },
  });
});

// ✅ 404 HANDLER
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ✅ GLOBAL ERROR HANDLER
app.use(errorHandler);

module.exports = app;
