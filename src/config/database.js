const mongoose = require("mongoose");

let isConnected = false;
let retryCount = 0;

const MAX_RETRIES = 5;
let reconnecting = false;

const connectDB = async () => {
  if (isConnected || reconnecting) return;

  reconnecting = true;

  try {
    console.log("🔄 Connecting to MongoDB...");

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      family: 4,
    });

    isConnected = true;
    retryCount = 0;

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);
  } catch (error) {
    retryCount++;
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    if (retryCount >= MAX_RETRIES) {
      console.error("❌ Max retries reached. Stopping.");
      reconnecting = false;
      return;
    }

    console.log(`⏳ Retry ${retryCount}/${MAX_RETRIES} in 5 seconds...`);

    setTimeout(() => {
      reconnecting = false;
      connectDB();
    }, 5000);

    return;
  }

  reconnecting = false;
};

/**
 * EVENTS (only once)
 */
mongoose.connection.on("connected", () => {
  console.log("🟢 MongoDB connected");
  isConnected = true;
});

mongoose.connection.on("disconnected", () => {
  console.warn("🟡 MongoDB disconnected");

  isConnected = false;

  if (!reconnecting && retryCount < MAX_RETRIES) {
    reconnecting = true;
    setTimeout(() => {
      reconnecting = false;
      connectDB();
    }, 5000);
  }
});

mongoose.connection.on("reconnected", () => {
  console.log("🟢 MongoDB reconnected");
  isConnected = true;
  retryCount = 0;
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 MongoDB error:", err.message);
});

module.exports = connectDB;
