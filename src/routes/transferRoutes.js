// routes/transferRoutes.js
const express = require("express");
const router = express.Router();
const transferUpload = require("../middleware/transferUpload");
const { protect } = require("../middleware/authMiddleware");
const {
  initiateTransfer,
  verifyOTPAndSend,
  resendOTP,
  getTransfer,
  trackDownload,
  getAllTransfers,
  getTransferStats,
  deleteTransfer,
} = require("../controllers/transferController");

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transfers/initiate
 * Body (multipart/form-data):
 *   senderEmail    — required
 *   senderName     — optional
 *   receiverEmail  — required
 *   receiverName   — optional
 *   message        — optional (max 500 chars)
 *   files[]        — 1–10 files, each ≤ 15 MB
 *
 * Response: { transferId, status:"pending_otp", filesCount, totalSize, otpExpiresAt }
 * Side-effect: sends OTP email to senderEmail
 */
router.post("/initiate", transferUpload.array("files", 10), initiateTransfer);

/**
 * POST /api/transfers/:transferId/verify-otp
 * Body: { otp: "123456" }
 *
 * Response: { transferId, status:"sent", receiver, filesCount, expiresAt }
 * Side-effect: sends download email to receiver + confirmation email to sender
 */
router.post("/:transferId/verify-otp", verifyOTPAndSend);

/**
 * POST /api/transfers/:transferId/resend-otp
 * No body required.
 *
 * Response: { message, otpExpiresAt }
 * Side-effect: sends new OTP to senderEmail
 */
router.post("/:transferId/resend-otp", resendOTP);

/**
 * GET /api/transfers/:transferId
 * Public download info page (used by the frontend download page)
 *
 * Response: transfer details with file list and download URLs
 */
router.get("/:transferId", getTransfer);

/**
 * POST /api/transfers/:transferId/files/:fileId/download
 * Increments download counter and returns the download URL.
 *
 * Response: { downloadUrl, originalName, mimetype }
 */
router.post("/:transferId/files/:fileId/download", trackDownload);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (protected)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transfers
 * Query params: page, limit, status, search
 */
router.get("/", protect, getAllTransfers);

/**
 * GET /api/transfers/admin/stats
 */
router.get("/admin/stats", protect, getTransferStats);

/**
 * DELETE /api/transfers/:transferId
 * Also removes Cloudinary files if configured.
 */
router.delete("/:transferId", protect, deleteTransfer);

// ─────────────────────────────────────────────────────────────────────────────
// Multer error handler (must be defined after routes)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "One or more files exceed the 15 MB size limit",
      code: "FILE_TOO_LARGE",
    });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "Maximum 10 files allowed per transfer",
      code: "TOO_MANY_FILES",
    });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: err.message || "Unexpected file type",
      code: "INVALID_FILE_TYPE",
    });
  }
  next(err);
});

module.exports = router;
