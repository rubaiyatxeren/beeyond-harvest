const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorMiddleware");
const mongoose = require("mongoose");

// ✅ IMPORT ROUTES
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

// ✅ FIX 1: Trust proxy (Render uses proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

// CORS configuration
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
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked origin:", origin);
        callback(null, true); // Allow but log
      }
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

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ✅ FIX 2: Rate limiting with proper IPv6 handling
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,

  // ✅ FIX: Proper key generator with IPv6 support
  keyGenerator: (req) => {
    // Get client IP from X-Forwarded-For header (Render proxy)
    const forwarded = req.headers["x-forwarded-for"];
    let ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;

    // Remove port if present (for IPv6 compatibility)
    if (ip && ip.includes(":")) {
      // For IPv6, remove port if present (format: [::1]:port)
      ip = ip.split(":").slice(0, -1).join(":");
    }
    return ip;
  },

  // ✅ FIX: Disable validation warnings
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
});
app.use("/api", limiter);

// app.js — fix: remove the first duplicate, keep only this one
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText =
    {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    }[dbStatus] || "unknown";

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Server is running",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    database: {
      status: dbStatusText,
      host: mongoose.connection.host || "not connected",
      name: mongoose.connection.name || "not connected",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`,
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
