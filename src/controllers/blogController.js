const Blog = require("../models/Blog");
const { generateSlug } = require("../models/Blog");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pick = (obj, keys) =>
  keys.reduce(
    (acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc),
    {},
  );

const parseIntSafe = (val, fallback) => {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
};

// ─── @desc    Create a new blog post
// ─── @route   POST /api/blogs
// ─── @access  Private (admin)
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      body,
      category,
      tags,
      status,
      author,
      coverImage,
      gallery,
      seo,
      relatedProducts,
      relatedPosts,
      isFeatured,
      isPinned,
      allowComments,
      language,
      scheduledAt,
    } = req.body;

    if (!title || !body || !category || !author?.name) {
      return res.status(400).json({
        success: false,
        message: "title, body, category, and author.name are required",
      });
    }

    // Ensure slug uniqueness — append timestamp if collision
    let finalSlug = slug || generateSlug(title);
    const existing = await Blog.findOne({ slug: finalSlug });
    if (existing) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const blog = await Blog.create({
      title,
      body,
      category,
      author,
      slug: finalSlug,
      excerpt,
      tags,
      status,
      coverImage,
      gallery,
      seo,
      relatedProducts,
      relatedPosts,
      isFeatured,
      isPinned,
      allowComments,
      language,
      scheduledAt,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A post with this slug already exists",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Get all blogs (with filtering, sorting, pagination)
// ─── @route   GET /api/blogs
// ─── @access  Public (published only) | Private (all statuses with token)
exports.getBlogs = async (req, res) => {
  try {
    const {
      page,
      limit,
      status,
      category,
      tag,
      featured,
      pinned,
      search,
      sort,
      language,
      author,
    } = req.query;

    const currentPage = parseIntSafe(page, 1);
    const perPage = Math.min(parseIntSafe(limit, 12), 50); // cap at 50
    const skip = (currentPage - 1) * perPage;

    // ── Build filter ──────────────────────────────────────────────────────────
    const filter = { deletedAt: null };

    // Non-admins only see published posts
    if (!req.user) {
      filter.status = "published";
    } else if (status) {
      filter.status = status;
    }

    if (category) filter.category = { $regex: category, $options: "i" };
    if (tag) filter.tags = tag.toLowerCase().trim();
    if (language) filter.language = language;
    if (author) filter["author.name"] = { $regex: author, $options: "i" };
    if (featured === "true") filter.isFeatured = true;
    if (pinned === "true") filter.isPinned = true;

    // Full-text search (uses the compound text index)
    if (search) {
      filter.$text = { $search: search };
    }

    // ── Sort ──────────────────────────────────────────────────────────────────
    const sortMap = {
      newest: { isPinned: -1, publishedAt: -1 },
      oldest: { publishedAt: 1 },
      popular: { views: -1 },
      trending: { likes: -1, views: -1 },
      az: { title: 1 },
    };
    const sortOption = sortMap[sort] || sortMap.newest;

    // ── Execute ───────────────────────────────────────────────────────────────
    const [posts, total] = await Promise.all([
      Blog.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .select("-body -comments -__v") // lean listing — omit heavy fields
        .populate("relatedProducts", "name price images")
        .lean({ virtuals: true }),
      Blog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        total,
        page: currentPage,
        pages: Math.ceil(total / perPage),
        perPage,
        hasNext: currentPage < Math.ceil(total / perPage),
        hasPrev: currentPage > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Get single blog by slug or ID
// ─── @route   GET /api/blogs/:identifier
// ─── @access  Public (published) | Private (any)
exports.getBlog = async (req, res) => {
  try {
    const { identifier } = req.params;

    // Support both slug and MongoDB ObjectId
    const isObjectId = /^[a-f\d]{24}$/i.test(identifier);
    const query = isObjectId ? { _id: identifier } : { slug: identifier };

    // Non-admins can only access published posts
    if (!req.user) query.status = "published";
    query.deletedAt = null;

    const blog = await Blog.findOne(query)
      .populate("relatedProducts", "name price images slug")
      .populate("relatedPosts", "title slug coverImage publishedAt")
      .lean({ virtuals: true });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Increment views asynchronously (don't await — non-critical)
    Blog.incrementViews(blog._id).catch(() => {});

    // Filter unapproved comments for non-admins
    if (!req.user) {
      blog.comments = blog.comments?.filter((c) => c.isApproved) ?? [];
    }

    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Update a blog post
// ─── @route   PUT /api/blogs/:id
// ─── @access  Private (admin)
exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const allowed = [
      "title",
      "slug",
      "excerpt",
      "body",
      "category",
      "tags",
      "status",
      "author",
      "coverImage",
      "gallery",
      "seo",
      "relatedProducts",
      "relatedPosts",
      "isFeatured",
      "isPinned",
      "allowComments",
      "language",
      "scheduledAt",
    ];

    const updates = pick(req.body, allowed);

    // Slug change: check uniqueness
    if (updates.slug && updates.slug !== blog.slug) {
      const conflict = await Blog.findOne({
        slug: updates.slug,
        _id: { $ne: blog._id },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "Slug already in use by another post",
        });
      }
    }

    Object.assign(blog, updates);
    blog.updatedBy = req.user?._id;

    await blog.save();

    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Soft-delete a blog post
// ─── @route   DELETE /api/blogs/:id
// ─── @access  Private (admin)
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    await blog.softDelete();

    res.json({ success: true, message: "Post archived (soft-deleted)" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Permanently delete a blog post
// ─── @route   DELETE /api/blogs/:id/permanent
// ─── @access  Private (super_admin)
exports.permanentDeleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    res.json({ success: true, message: "Post permanently deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Toggle publish status (draft ↔ published)
// ─── @route   PATCH /api/blogs/:id/toggle-publish
// ─── @access  Private (admin)
exports.togglePublish = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    blog.status = blog.status === "published" ? "draft" : "published";
    if (blog.status === "published" && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }
    await blog.save();

    res.json({
      success: true,
      message: `Post ${blog.status === "published" ? "published" : "unpublished"}`,
      data: { status: blog.status, publishedAt: blog.publishedAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Like a blog post
// ─── @route   POST /api/blogs/:id/like
// ─── @access  Public
exports.likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { _id: req.params.id, status: "published", deletedAt: null },
      { $inc: { likes: 1 } },
      { new: true, select: "likes" },
    );

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    res.json({ success: true, data: { likes: blog.likes } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Add a comment to a blog post
// ─── @route   POST /api/blogs/:id/comments
// ─── @access  Public
exports.addComment = async (req, res) => {
  try {
    const { author, email, body } = req.body;

    if (!author || !email || !body) {
      return res.status(400).json({
        success: false,
        message: "author, email, and body are required",
      });
    }

    const blog = await Blog.findOne({
      _id: req.params.id,
      status: "published",
      deletedAt: null,
      allowComments: true,
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Post not found or comments are disabled",
      });
    }

    const comment = {
      author: author.trim(),
      email: email.trim().toLowerCase(),
      body: body.trim(),
      ip: req.ip,
      isApproved: false, // requires admin approval
    };

    blog.comments.push(comment);
    await blog.save();

    res.status(201).json({
      success: true,
      message: "Comment submitted and awaiting approval",
      data: comment,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Approve or reject a comment
// ─── @route   PATCH /api/blogs/:id/comments/:commentId/approve
// ─── @access  Private (admin)
exports.approveComment = async (req, res) => {
  try {
    const { approve } = req.body; // true = approve, false = reject/delete

    const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const comment = blog.comments.id(req.params.commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    if (approve === false) {
      comment.deleteOne();
      await blog.save();
      return res.json({
        success: true,
        message: "Comment rejected and removed",
      });
    }

    comment.isApproved = true;
    comment.approvedAt = new Date();
    await blog.save();

    res.json({ success: true, message: "Comment approved", data: comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Delete a comment (admin)
// ─── @route   DELETE /api/blogs/:id/comments/:commentId
// ─── @access  Private (admin)
exports.deleteComment = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, deletedAt: null });
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const comment = blog.comments.id(req.params.commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    comment.deleteOne();
    await blog.save();

    res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Get all categories with post counts
// ─── @route   GET /api/blogs/meta/categories
// ─── @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await Blog.aggregate([
      { $match: { status: "published", deletedAt: null } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Get popular tags with post counts
// ─── @route   GET /api/blogs/meta/tags
// ─── @access  Public
exports.getTags = async (req, res) => {
  try {
    const tags = await Blog.aggregate([
      { $match: { status: "published", deletedAt: null } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
      { $project: { _id: 0, tag: "$_id", count: 1 } },
    ]);

    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Blog analytics summary (admin dashboard card)
// ─── @route   GET /api/blogs/meta/analytics
// ─── @access  Private (admin)
exports.getBlogAnalytics = async (req, res) => {
  try {
    const [overview, topPosts, recentActivity] = await Promise.all([
      // Overview counts
      Blog.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
            archived: {
              $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
            },
            totalViews: { $sum: "$views" },
            totalLikes: { $sum: "$likes" },
            totalComments: { $sum: { $size: "$comments" } },
          },
        },
      ]),

      // Top 5 posts by views
      Blog.find({ status: "published", deletedAt: null })
        .sort({ views: -1 })
        .limit(5)
        .select("title slug views likes publishedAt")
        .lean(),

      // Posts created in the last 30 days
      Blog.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        deletedAt: null,
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: overview[0] || {},
        topPosts,
        last30Days: recentActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── @desc    Get pending (unapproved) comments (admin moderation queue)
// ─── @route   GET /api/blogs/meta/pending-comments
// ─── @access  Private (admin)
exports.getPendingComments = async (req, res) => {
  try {
    const blogs = await Blog.find({
      "comments.isApproved": false,
      deletedAt: null,
    })
      .select("title slug comments")
      .lean();

    const pending = [];
    for (const blog of blogs) {
      for (const comment of blog.comments) {
        if (!comment.isApproved) {
          pending.push({
            blogId: blog._id,
            blogTitle: blog.title,
            blogSlug: blog.slug,
            comment,
          });
        }
      }
    }

    // Sort newest first
    pending.sort(
      (a, b) => new Date(b.comment.createdAt) - new Date(a.comment.createdAt),
    );

    res.json({ success: true, total: pending.length, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
