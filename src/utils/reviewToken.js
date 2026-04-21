const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const dotenv = require("dotenv");
dotenv.config();

const REVIEW_SECRET =
  process.env.REVIEW_TOKEN_SECRET || process.env.JWT_SECRET + "_review";
const EXPIRES_IN = "7d";

/**
 * Generate a signed review token for one product in an order.
 * Each product in an order gets its own token.
 */
function generateReviewToken(orderId, productId, customerEmail) {
  return jwt.sign(
    {
      orderId: String(orderId),
      productId: String(productId),
      email: customerEmail,
    },
    REVIEW_SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

/**
 * Verify and decode a review token.
 * Returns { orderId, productId, email } or throws.
 */
function verifyReviewToken(token) {
  return jwt.verify(token, REVIEW_SECRET);
}

/**
 * Hash a token for safe DB storage (we don't store raw JWT).
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { generateReviewToken, verifyReviewToken, hashToken };
