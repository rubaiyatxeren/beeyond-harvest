const dotenv = require("dotenv");
dotenv.config();

// ✅ MUST be first — before anything else loads
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message, err.stack);

  // Only shutdown on truly fatal errors
  const isFatal =
    err.code === "ERR_USE_AFTER_FREE" ||
    err.code === "ENOMEM" ||
    err?.name === "MongoNetworkError" ||
    err?.name === "MongooseServerSelectionError";

  if (isFatal) {
    console.error("❌ Fatal — shutting down...");
    shutdown("UNCAUGHT_EXCEPTION");
  }
  // Non-fatal: log only, keep running
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error("❌ Unhandled Rejection:", err.message, err.stack);

  // Only shutdown on DB errors — everything else: log and continue
  const isDbError =
    err?.name === "MongoNetworkError" ||
    err?.name === "MongooseServerSelectionError" ||
    err?.code === "ECONNRESET";

  if (isDbError) {
    console.error("❌ DB error → restarting...");
    shutdown("UNHANDLED_REJECTION");
  }
});

const app = require("./src/app");
const connectDB = require("./src/config/database");
const Admin = require("./src/models/Admin");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
const TIME_OUT_MS = 25000;

let server;
let memoryMonitor;

// ==============================
// ✅ GRACEFUL SHUTDOWN
// ==============================
const shutdown = async (signal) => {
  if (shutdown.shuttingDown) return;
  shutdown.shuttingDown = true;

  console.log(`⚠️ Shutdown: ${signal}`);

  // Stop memory monitor so it doesn't keep process alive
  if (memoryMonitor) clearInterval(memoryMonitor);

  const forceExit = setTimeout(() => {
    console.error("⚠️ Force exit after timeout");
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("✅ HTTP server closed");
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ MongoDB closed");
    }
    clearTimeout(forceExit);
    process.exit(signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
  } catch (err) {
    console.error("❌ Shutdown error:", err.message);
    clearTimeout(forceExit);
    process.exit(1);
  }
};

// ==============================
// ✅ TIMEOUT MIDDLEWARE
// Must be added to app before routes in app.js,
// OR here before startServer if you control middleware order
// ==============================
app.use((req, res, next) => {
  req.setTimeout(TIME_OUT_MS, () => {
    console.error(`⏰ Request timeout: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: "Request timeout." });
    }
  });
  res.setTimeout(TIME_OUT_MS, () => {
    console.error(`⏰ Response timeout: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: "Server timeout." });
    }
  });
  next();
});

// ==============================
// ✅ CREATE DEFAULT ADMIN
// ==============================
const createDefaultAdmin = async () => {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn("⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set");
      return;
    }
    const exists = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!exists) {
      await Admin.create({
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: "super_admin",
        isActive: true,
      });
      console.log("✅ Default admin created");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (err) {
    console.error("❌ Admin creation failed:", err.message);
    // Non-fatal — don't crash startup
  }
};

// ==============================
// ✅ MEMORY MONITOR
// ==============================
const startMemoryMonitor = () => {
  memoryMonitor = setInterval(() => {
    const used = process.memoryUsage();
    const rssMB = (used.rss / 1024 / 1024).toFixed(2);
    const heapUsedMB = (used.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (used.heapTotal / 1024 / 1024).toFixed(2);

    if (rssMB > 400) {
      console.warn(
        `⚠️ High memory: RSS=${rssMB}MB Heap=${heapUsedMB}/${heapTotalMB}MB`,
      );
    }
  }, 30000);

  // ✅ Unref so this timer doesn't prevent graceful shutdown
  memoryMonitor.unref();
};

// ==============================
// ✅ START SERVER
// ==============================
const startServer = async () => {
  try {
    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }
    console.log("✅ MongoDB connected");

    await createDefaultAdmin();

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "dev"})`,
      );
      console.log(`❤️  Health: /health`);
    });

    server.on("error", (err) => {
      console.error("❌ Server error:", err.message);
      shutdown("SERVER_ERROR");
    });

    startMemoryMonitor();
  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
};

startServer();

// ==============================
// ✅ RENDER SIGNALS
// ==============================
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ==============================
// ✅ MONGOOSE EVENTS
// ==============================
mongoose.connection.on("connected", () => console.log("🟢 MongoDB connected"));
mongoose.connection.on("error", (err) =>
  console.error("🔴 MongoDB error:", err.message),
);
mongoose.connection.on("disconnected", () =>
  console.warn("🟡 MongoDB disconnected — retrying..."),
);
mongoose.connection.on("reconnected", () =>
  console.log("🟢 MongoDB reconnected"),
);

process.on("exit", (code) => console.log(`📋 Process exit: ${code}`));
