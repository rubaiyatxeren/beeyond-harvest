const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/database");
const Admin = require("./src/models/Admin");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
let server;

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
      console.log("✅ Default admin already exists");
    }
  } catch (err) {
    console.error("❌ Admin creation failed:", err.message);
  }
};

// ==============================
// ✅ GRACEFUL SHUTDOWN
// ==============================
const shutdown = async (signal) => {
  console.log(`⚠️ Shutdown initiated: ${signal}`);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("✅ HTTP server closed");
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
    }

    process.exit(signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
  } catch (err) {
    console.error("❌ Shutdown error:", err.message);
    process.exit(1);
  }
};

// ==============================
// ✅ START SERVER
// ==============================
const startServer = async () => {
  try {
    // 🔥 Connect DB (must succeed)
    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }

    console.log("✅ MongoDB connected");

    await createDefaultAdmin();

    // 🔥 Start server
    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running (${process.env.NODE_ENV || "dev"})`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`❤️ Health: /health`);
    });

    // 🔥 Catch server-level errors
    server.on("error", (err) => {
      console.error("❌ Server error:", err.message);
      shutdown("SERVER_ERROR");
    });
  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1); // Let Render restart cleanly
  }
};

startServer();

// ==============================
// 🔥 ERROR HANDLING (SMART)
// ==============================

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message, err.stack);

  if (
    err?.name === "MongoNetworkError" ||
    err?.name === "MongooseServerSelectionError"
  ) {
    console.error("❌ Critical DB error → restarting...");
    shutdown("UNHANDLED_REJECTION");
  }
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message, err.stack);

  if (
    err.code === "ERR_USE_AFTER_FREE" ||
    err.code === "ENOMEM" ||
    err?.name === "MongoNetworkError" ||
    err?.name === "MongooseServerSelectionError"
  ) {
    console.error("❌ Fatal error → restarting...");
    shutdown("UNCAUGHT_EXCEPTION");
  }
});

// ==============================
// 🔥 RENDER SIGNALS
// ==============================

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received");
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received");
  shutdown("SIGINT");
});

// ==============================
// 🔥 MONGOOSE EVENTS (STABLE)
// ==============================

mongoose.connection.on("connected", () => {
  console.log("🟢 MongoDB connected");
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 MongoDB error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("🟡 MongoDB disconnected — retrying...");
  // DO NOT exit — allow reconnect
});
