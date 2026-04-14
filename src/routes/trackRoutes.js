const express = require("express");
const router = express.Router();
const {
  ingestEvents,
  getSessions,
  getSessionDetail,
  getStats,
  linkSession,
} = require("../controllers/trackController");
const { protect } = require("../middleware/authMiddleware");

// Public — called from frontend tracker (rate-limited by your existing limiter)
router.post("/events", ingestEvents);

// Admin only
router.get("/sessions", protect, getSessions);
router.get("/sessions/:sessionId", protect, getSessionDetail);
router.get("/stats", protect, getStats);
router.patch("/sessions/:sessionId/link", linkSession);

module.exports = router;
