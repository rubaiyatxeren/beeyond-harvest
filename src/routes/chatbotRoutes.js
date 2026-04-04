const express = require("express");
const router = express.Router();
const {
  processMessage,
  getSuggestions,
} = require("../controllers/chatbotController");

// POST /api/chatbot/message  — process user message
router.post("/message", processMessage);

// GET  /api/chatbot/suggestions — get initial quick replies
router.get("/suggestions", getSuggestions);

module.exports = router;
