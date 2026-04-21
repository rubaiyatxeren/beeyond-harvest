const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  validateToken,
  submitReview,
  getProductReviews,
  voteReview,
  adminGetReviews,
  moderateReview,
  deleteReview,
} = require("../controllers/reviewController");

// ── Public ─────────────────────────────────────────────────────────────────
router.get("/validate-token", validateToken); // GET  ?token=xxx
router.post("/", submitReview); // POST  { token, rating, title, body }
router.get("/product/:productId", getProductReviews); // GET  ?sort=newest&page=1
router.post("/:id/vote", voteReview); // POST { helpful, voterEmail }

// ── Admin ──────────────────────────────────────────────────────────────────
router.get("/admin", protect, adminGetReviews); // GET  ?status=pending
router.put("/admin/:id/moderate", protect, moderateReview); // PUT  { status, moderationNote }
router.delete("/admin/:id", protect, deleteReview); // DELETE

module.exports = router;
