const express = require("express");
const {
  loginAdmin,
  getMe,
  updateProfile,
  forgotPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/forgot-password", forgotPassword);
router.get("/me", protect, getMe);
router.put("/update", protect, updateProfile);

module.exports = router;
