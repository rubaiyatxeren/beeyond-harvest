const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = async () => {
  try {
    // Add connection options to prevent timeout issues
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds
      connectTimeoutMS: 10000, // Connection timeout
      maxPoolSize: 10, // Maintain up to 10 socket connections
      family: 4, // Use IPv4, skip trying IPv6
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    // Provide helpful error messages
    if (error.message.includes("ECONNREFUSED")) {
      console.error("\n🔧 Troubleshooting:");
      console.error("1. Make sure MongoDB is running");
      console.error("2. Check if MongoDB Atlas IP is whitelisted");
      console.error("3. Verify your connection string in .env file");
      console.error(
        "4. Try using local MongoDB: mongodb://localhost:27017/beeyond_harvest",
      );
    }

    // Don't exit immediately in development, allow retry
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.log("⚠️  Retrying connection in 5 seconds...");
      setTimeout(connectDB, 5000);
    }
  }
};

module.exports = connectDB;
