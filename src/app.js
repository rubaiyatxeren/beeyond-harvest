const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorMiddleware");
const mongoose = require("mongoose");

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

// CORS configuration (keep as is)
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
        callback(new Error("Not allowed by CORS"));
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

// ✅ FIX 2: Rate limiting with proper proxy handling
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,

  // Custom key generator to get real client IP from proxy
  keyGenerator: (req) => {
    // Get client IP from X-Forwarded-For header (Render proxy)
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = forwarded.split(",");
      return ips[0].trim();
    }
    // Fallback to req.ip (works after trust proxy is set)
    return req.ip;
  },
});
app.use("/api", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check - enhanced with database status
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
