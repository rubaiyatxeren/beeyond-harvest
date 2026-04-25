// routes/complaintRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createComplaint,
  getComplaints,
  getComplaintStats,
  getComplaint,
  trackComplaint,
  getMyComplaints,
  updateComplaintStatus,
  resolveComplaint,
  rejectComplaint,
  addReply,
  assignComplaint,
  flagComplaint,
  submitSatisfaction,
  deleteComplaint,
  bulkAction,
} = require("../controllers/complaintController");

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (customer-facing)
// ══════════════════════════════════════════════════════════════════════════════

// Submit a new complaint
// POST /api/complaints
router.post("/", createComplaint);

// Track a complaint by ticket number + email verification
// GET /api/complaints/track/:ticketNumber?email=customer@email.com
router.get("/track/:ticketNumber", trackComplaint);

// Get all complaints for a customer (by email or phone)
// GET /api/complaints/my?email=x@x.com  OR  ?phone=01XXXXXXXXX
router.get("/my", getMyComplaints);

// Customer submits satisfaction rating after resolution
// POST /api/complaints/satisfaction
router.post("/satisfaction", submitSatisfaction);

// Customer adds a reply to their own ticket
// (Uses ticketNumber + email in body for verification instead of JWT)
// POST /api/complaints/:id/customer-reply
router.post(
  "/:id/customer-reply",
  async (req, res, next) => {
    // Lightweight customer auth: verify email matches ticket
    try {
      const Complaint = require("../models/Complaint");
      const complaint = await Complaint.findById(req.params.id).select(
        "customer status",
      );
      if (!complaint)
        return res
          .status(404)
          .json({ success: false, message: "টিকেট পাওয়া যায়নি" });
      if (
        complaint.customer.email !== (req.body.email || "").toLowerCase().trim()
      ) {
        return res.status(403).json({ success: false, message: "অনুমতি নেই" });
      }
      req.body.senderType = "customer";
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  addReply,
);

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (protected)
// ══════════════════════════════════════════════════════════════════════════════

// Dashboard stats
// GET /api/complaints/stats
router.get("/stats", protect, getComplaintStats);

// Bulk action (close / resolve / reject multiple)
// POST /api/complaints/bulk-action
router.post("/bulk-action", protect, bulkAction);

// List all complaints (filterable, paginated)
// GET /api/complaints?status=open&priority=urgent&search=TKT
router.get("/", protect, getComplaints);

// Get single complaint with full details
// GET /api/complaints/:id
router.get("/:id", protect, getComplaint);

// Update lifecycle status (open → under_review → on_hold → escalated → closed)
// PATCH /api/complaints/:id/status
router.patch("/:id/status", protect, updateComplaintStatus);

// Resolve with resolution details (refund / replacement / coupon / apology)
// POST /api/complaints/:id/resolve
router.post("/:id/resolve", protect, resolveComplaint);

// Reject with a reason
// POST /api/complaints/:id/reject
router.post("/:id/reject", protect, rejectComplaint);

// Admin adds a reply (can be internal/private note or public)
// POST /api/complaints/:id/reply
router.post("/:id/reply", protect, addReply);

// Assign to admin / change priority
// PATCH /api/complaints/:id/assign
router.patch("/:id/assign", protect, assignComplaint);

// Flag as spam / fraudulent
// PATCH /api/complaints/:id/flag
router.patch("/:id/flag", protect, flagComplaint);

// Delete (hard delete — use carefully)
// DELETE /api/complaints/:id
router.delete("/:id", protect, deleteComplaint);

module.exports = router;
