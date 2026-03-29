const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: "../.env" }); // Adjust path if needed

// Import Admin model
const Admin = require("../src/models/Admin");

const updateAdminPassword = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get password from .env
    const envPassword = process.env.ADMIN_PASSWORD;
    const envEmail = process.env.ADMIN_EMAIL;

    console.log("Email from .env:", envEmail);
    console.log("Password from .env:", envPassword);
    console.log("Password length:", envPassword?.length);

    if (!envPassword || !envEmail) {
      throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD not found in .env file");
    }

    // Hash the password from .env
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(envPassword, salt);

    // Update admin
    const result = await Admin.updateOne(
      { email: envEmail },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log("\n✅ Admin password updated successfully!");
      console.log("📧 Email:", envEmail);
      console.log("🔑 New Password:", envPassword);
      console.log("⚠️  Use these credentials to login to admin panel\n");
    } else if (result.matchedCount > 0) {
      console.log("\n⚠️  Admin found but password might already be correct");
      console.log("📧 Email:", envEmail);
      console.log("🔑 Password in .env:", envPassword);

      // Verify if password matches
      const admin = await Admin.findOne({ email: envEmail });
      const isValid = await bcrypt.compare(envPassword, admin.password);
      if (isValid) {
        console.log("✅ Password in .env matches database!");
      } else {
        console.log(
          "❌ Password in .env does NOT match database. Try running script again.",
        );
      }
    } else {
      // Create new admin if doesn't exist
      console.log("Admin not found, creating new admin...");
      const newAdmin = new Admin({
        name: "Super Admin",
        email: envEmail,
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      });
      await newAdmin.save();
      console.log("\n✅ New admin created with .env password!");
      console.log("📧 Email:", envEmail);
      console.log("🔑 Password:", envPassword);
      console.log("⚠️  Use these credentials to login to admin panel\n");
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

// Run the function
updateAdminPassword();
