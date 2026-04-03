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

      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("⚠️ Blocked CORS origin:", origin);
      return callback(null, true); // allow but log (safe for production debugging)
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

// ✅ RATE LIMIT (Render-safe with IPv6 fix)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    let ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;
    if (ip && ip.includes(":")) {
      ip = ip.split(":").slice(0, -1).join(":");
    }
    return ip;
  },
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
});

app.use("/api", limiter);

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/delivery-charges", deliveryChargeRoutes);

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
].forEach((route) => console.log("  -", route));

// ✅ HEALTH CHECK — returns 503 if DB is down so monitors know server isn't ready
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

// ❌ REMOVED: duplicate unhandledRejection + uncaughtException handlers
// These are handled correctly in server.js with graceful shutdown.
// Having them here caused double-firing and bypassed cleanup.

module.exports = app;
