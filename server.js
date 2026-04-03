const dotenv = require("dotenv");
dotenv.config();

// ✅ NEVER shutdown on network/DB errors — mongoose auto-reconnects
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  if (err.code === "ERR_USE_AFTER_FREE" || err.code === "ENOMEM") {
    console.error("❌ Fatal OOM — shutting down");
    process.exit(1);
  }
  // everything else: log and survive
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("❌ Unhandled Rejection:", msg);
  // ✅ NEVER call shutdown here — ECONNRESET, MongoNetworkError etc are recoverable
});

const app = require("./src/app");
const connectDB = require("./src/config/database");
const Admin = require("./src/models/Admin");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
const TIME_OUT_MS = 25000;

let server;
let memoryMonitor;

// ─── Graceful shutdown (SIGTERM/SIGINT only) ──────────────────────────────────
const shutdown = async (signal) => {
  if (shutdown._busy) return;
  shutdown._busy = true;
  console.log(`⚠️ Shutdown: ${signal}`);
  if (memoryMonitor) clearInterval(memoryMonitor);
  const force = setTimeout(() => process.exit(1), 10000);
  try {
    if (server) await new Promise((r) => server.close(r));
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
  } catch {}
  clearTimeout(force);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Timeout middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.setTimeout(TIME_OUT_MS, () => {
    if (!res.headersSent)
      res.status(504).json({ success: false, message: "Request timeout." });
  });
  res.setTimeout(TIME_OUT_MS, () => {
    if (!res.headersSent)
      res.status(504).json({ success: false, message: "Server timeout." });
  });
  next();
});

// ─── Seed admin ───────────────────────────────────────────────────────────────
const createDefaultAdmin = async () => {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
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
  }
};

// ─── Memory monitor ───────────────────────────────────────────────────────────
const startMemoryMonitor = () => {
  memoryMonitor = setInterval(() => {
    const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    if (mb > 400) console.warn(`⚠️ High memory: ${mb}MB RSS`);
  }, 60000);
  memoryMonitor.unref();
};

// ─── Keep-alive self-ping ─────────────────────────────────────────────────────
const startKeepAlive = () => {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) return;
  setInterval(
    () => {
      fetch(`${url}/health`).catch(() => {});
    },
    8 * 60 * 1000,
  ); // every 8 min (UptimeRobot covers 5 min, this is backup)
};

// ─── Mongoose event logs (single source) ─────────────────────────────────────
mongoose.connection.on("error", (e) =>
  console.error("🔴 MongoDB error:", e.message),
);
mongoose.connection.on("disconnected", () =>
  console.warn("🟡 MongoDB disconnected — retrying..."),
);
mongoose.connection.on("reconnected", () =>
  console.log("🟢 MongoDB reconnected"),
);

// ─── Boot ─────────────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    if (mongoose.connection.readyState !== 1)
      throw new Error("MongoDB not ready after connect");

    await createDefaultAdmin();

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "dev"})`,
      );
      console.log(`❤️  Health: /health`);
      if (process.env.NODE_ENV === "production") startKeepAlive();
    });

    server.on("error", (err) => {
      console.error("❌ HTTP server error:", err.message);
      // don't shutdown — let Render handle it
    });

    startMemoryMonitor();
  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
};

startServer();
