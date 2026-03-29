const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/database");
const Admin = require("./src/models/Admin");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
let server;

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to database with retry logic
    await connectDB();

    // Create default admin after database is connected
    await createDefaultAdmin();

    // Start server only after database is connected
    server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// Create default admin if not exists
const createDefaultAdmin = async () => {
  try {
    // Check if Admin model exists and database is connected
    if (mongoose.connection.readyState !== 1) {
      console.log(
        "⚠️ Waiting for database connection before creating admin...",
      );
      await new Promise((resolve) => {
        mongoose.connection.once("connected", resolve);
      });
    }

    // Check if admin email is configured
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn(
        "⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set in environment variables",
      );
      console.warn("Default admin will not be created automatically");
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
      console.log(`📧 Admin Email: ${process.env.ADMIN_EMAIL}`);
    } else {
      console.log("✅ Default admin already exists");
    }
  } catch (error) {
    console.error("❌ Error creating default admin:", error.message);
    // Don't crash the server if admin creation fails
  }
};

// Start the server
startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  console.error(err.stack);
  // Close server & exit process
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  // Close server & exit process
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received. Closing server gracefully...");
  if (server) {
    server.close(() => {
      console.log("✅ Server closed");
      mongoose.connection.close(false, () => {
        console.log("✅ MongoDB connection closed");
        process.exit(0);
      });
    });
  }
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received. Closing server gracefully...");
  if (server) {
    server.close(() => {
      console.log("✅ Server closed");
      mongoose.connection.close(false, () => {
        console.log("✅ MongoDB connection closed");
        process.exit(0);
      });
    });
  }
});
