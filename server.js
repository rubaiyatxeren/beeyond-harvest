const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/database");
const Admin = require("./src/models/Admin");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
let server;

// Create default admin if not exists
const createDefaultAdmin = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log(
        "⏳ Waiting for database connection before creating admin...",
      );
      await new Promise((resolve) => {
        mongoose.connection.once("connected", resolve);
      });
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn("⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set");
      return;
    }

    const adminExists = await Admin.findOne({ email: process.env.ADMIN_EMAIL });

    if (!adminExists) {
      await Admin.create({
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: "super_admin",
        isActive: true,
      });
      console.log("✅ Default admin created successfully");
    } else {
      console.log("✅ Default admin already exists");
    }
  } catch (error) {
    console.error("❌ Error creating default admin:", error.message);
  }
};

// Start the server
const startServer = async () => {
  try {
    await connectDB();
    await createDefaultAdmin();

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
      console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`✅ Bound to 0.0.0.0:${PORT} - Ready for Render`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// ✅ FIXED: Graceful shutdown for Mongoose 7+
process.on("unhandledRejection", (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  console.error(err.stack);
  if (server) {
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed");
      } catch (e) {
        console.error("Error closing MongoDB:", e.message);
      }
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  if (server) {
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed");
      } catch (e) {
        console.error("Error closing MongoDB:", e.message);
      }
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// ✅ FIXED: SIGTERM handler
process.on("SIGTERM", async () => {
  console.log("👋 SIGTERM received. Closing server gracefully...");
  if (server) {
    server.close(async () => {
      console.log("✅ HTTP server closed");
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed");
      } catch (err) {
        console.error("❌ Error closing MongoDB:", err.message);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// ✅ FIXED: SIGINT handler (Ctrl+C)
process.on("SIGINT", async () => {
  console.log("👋 SIGINT received. Closing server gracefully...");
  if (server) {
    server.close(async () => {
      console.log("✅ HTTP server closed");
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed");
      } catch (err) {
        console.error("❌ Error closing MongoDB:", err.message);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
