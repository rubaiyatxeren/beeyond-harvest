const express = require("express");
const {
  loginAdmin,
  getMe,
  updateProfile,
  forgotPassword,
  registerAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/login", loginAdmin);
router.post("/forgot-password", forgotPassword);

// Protected routes (require authentication)
router.get("/me", protect, getMe);
router.put("/update", protect, updateProfile);

// Super admin only routes
router.post("/register", protect, registerAdmin); // Create admin/manager
router.get("/admins", protect, getAllAdmins); // Get all admins & managers
router.put("/admins/:id", protect, updateAdmin); // Update admin/manager
router.delete("/admins/:id", protect, deleteAdmin); // Delete admin/manager

module.exports = router;
