const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createBlog,
  getBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  permanentDeleteBlog,
  togglePublish,
  likeBlog,
  addComment,
  approveComment,
  deleteComment,
  getCategories,
  getTags,
  getBlogAnalytics,
  getPendingComments,
} = require("../controllers/blogController");

// ─────────────────────────────────────────────────────────────────────────────
//  META ROUTES  (must be defined BEFORE /:identifier to avoid route collision)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/blogs/meta/categories  — public tag cloud / category list
router.get("/meta/categories", getCategories);

// GET /api/blogs/meta/tags  — public tag cloud
router.get("/meta/tags", getTags);

// GET /api/blogs/meta/analytics  — admin dashboard card
router.get(
  "/meta/analytics",
  protect,
  authorize("admin", "super_admin"),
  getBlogAnalytics,
);

// GET /api/blogs/meta/pending-comments  — comment moderation queue
router.get(
  "/meta/pending-comments",
  protect,
  authorize("admin", "super_admin"),
  getPendingComments,
);

// ─────────────────────────────────────────────────────────────────────────────
//  CORE BLOG CRUD
// ─────────────────────────────────────────────────────────────────────────────

router
  .route("/")
  // GET  /api/blogs  — public (returns published); admin sees all statuses
  .get(getBlogs)
  // POST /api/blogs  — create (admin only)
  .post(protect, authorize("admin", "super_admin"), createBlog);

router
  .route("/:id")
  // PUT    /api/blogs/:id  — update
  .put(protect, authorize("admin", "super_admin"), updateBlog)
  // DELETE /api/blogs/:id  — soft delete (sets deletedAt, status → archived)
  .delete(protect, authorize("admin", "super_admin"), deleteBlog);

// DELETE /api/blogs/:id/permanent  — hard delete (super_admin only)
router.delete(
  "/:id/permanent",
  protect,
  authorize("super_admin"),
  permanentDeleteBlog,
);

// PATCH /api/blogs/:id/toggle-publish
router.patch(
  "/:id/toggle-publish",
  protect,
  authorize("admin", "super_admin"),
  togglePublish,
);

// ─────────────────────────────────────────────────────────────────────────────
//  ENGAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/blogs/:id/like  — public like increment
router.post("/:id/like", likeBlog);

// ─────────────────────────────────────────────────────────────────────────────
//  COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/blogs/:id/comments  — public: submit a comment (goes to moderation)
router.post("/:id/comments", addComment);

// PATCH /api/blogs/:id/comments/:commentId/approve  — admin: approve or reject
router.patch(
  "/:id/comments/:commentId/approve",
  protect,
  authorize("admin", "super_admin"),
  approveComment,
);

// DELETE /api/blogs/:id/comments/:commentId  — admin: hard delete a comment
router.delete(
  "/:id/comments/:commentId",
  protect,
  authorize("admin", "super_admin"),
  deleteComment,
);

// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE POST  (slug OR ObjectId — keep LAST to avoid catching meta routes)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/blogs/:identifier  — public (slug) | admin (any status)
// Optionally attach `protect` as optional middleware:
//   - If token present → req.user set → can see drafts
//   - If no token     → req.user undefined → published only
router.get("/:identifier", (req, res, next) => {
  // Try to verify token silently; don't block if missing
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) {
    return protect(req, res, () => getBlog(req, res, next));
  }
  return getBlog(req, res, next);
});

module.exports = router;
