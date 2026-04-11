const Order = require("../models/Order");
const FraudLog = require("../models/FraudLog");
const { analyzeOrder, saveAnalysis } = require("../utils/fraudEngine");

// ─── Helper: extract request metadata ────────────────────────────────────────
const extractRequestMeta = (req) => ({
  ipAddress:
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown",
  userAgent: req.headers["user-agent"] || "",
  headers: req.headers,
});

// @desc    Analyze a specific order for fraud (on-demand)
// @route   POST /api/fraud/analyze/:orderId
// @access  Private (Admin)
const analyzeOrderById = async (req, res) => {
  try {
    console.log(`🔍 [FRAUD] Analyzing order: ${req.params.orderId}`);

    const order = await Order.findById(req.params.orderId).lean();
    if (!order) {
      console.log(`❌ [FRAUD] Order not found: ${req.params.orderId}`);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    console.log(`✅ [FRAUD] Order found: ${order.orderNumber}`);

    const requestMeta = extractRequestMeta(req);
    const result = await analyzeOrder(order, requestMeta);
    const log = await saveAnalysis(order, result, requestMeta);

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        riskScore: result.riskScore,
        verdict: result.verdict,
        allFlags: result.allFlags,
        signals: result.signals,
        logId: log?._id,
        analysisTime: result.analysisTime,
      },
    });
  } catch (error) {
    console.error("❌ [FRAUD] Analyze error:", error);
    console.error("❌ Stack trace:", error.stack);
    // Send proper error response
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Re-analyze ALL recent orders in bulk (admin tool)
// @route   POST /api/fraud/bulk-scan
// @access  Private (Admin)
const bulkScan = async (req, res) => {
  try {
    const { hours = 24, limit = 100 } = req.body;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const orders = await Order.find({
      createdAt: { $gte: since },
      orderStatus: { $nin: ["cancelled", "returned"] },
    })
      .sort("-createdAt")
      .limit(Math.min(limit, 500))
      .lean();

    console.log(
      `🛡️  [BULK SCAN] Scanning ${orders.length} orders from last ${hours}h`,
    );

    const requestMeta = extractRequestMeta(req);
    const results = {
      total: orders.length,
      safe: 0,
      review: 0,
      blocked: 0,
      errors: 0,
    };
    const flagged = [];

    for (const order of orders) {
      try {
        const result = await analyzeOrder(order, requestMeta);
        await saveAnalysis(order, result, requestMeta);
        results[result.verdict]++;
        if (result.verdict !== "safe") {
          flagged.push({
            orderNumber: order.orderNumber,
            orderId: order._id,
            verdict: result.verdict,
            riskScore: result.riskScore,
            topFlags: result.allFlags.slice(0, 3),
          });
        }
      } catch {
        results.errors++;
      }
    }

    console.log(
      `✅ [BULK SCAN] Done: safe=${results.safe} review=${results.review} blocked=${results.blocked}`,
    );

    res.json({ success: true, results, flagged });
  } catch (error) {
    console.error("❌ [BULK SCAN] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all fraud logs (paginated + filtered)
// @route   GET /api/fraud/logs
// @access  Private (Admin)
const getFraudLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.verdict) query.verdict = req.query.verdict;
    if (req.query.reviewAction === "pending") query.reviewAction = null;
    else if (req.query.reviewAction)
      query.reviewAction = req.query.reviewAction;

    if (req.query.minScore)
      query.riskScore = { $gte: parseInt(req.query.minScore) };
    if (req.query.maxScore) {
      query.riskScore = {
        ...(query.riskScore || {}),
        $lte: parseInt(req.query.maxScore),
      };
    }

    const [logs, total] = await Promise.all([
      FraudLog.find(query)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate(
          "order",
          "orderNumber customer.name customer.phone total orderStatus",
        )
        .lean(),
      FraudLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single fraud log
// @route   GET /api/fraud/logs/:id
// @access  Private (Admin)
const getFraudLog = async (req, res) => {
  try {
    const log = await FraudLog.findById(req.params.id).populate("order");
    if (!log)
      return res
        .status(404)
        .json({ success: false, message: "Fraud log not found" });
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Review a fraud log (approve / reject / escalate)
// @route   PUT /api/fraud/logs/:id/review
// @access  Private (Admin)
const reviewFraudLog = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!["approved", "rejected", "escalated"].includes(action)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid action" });
    }

    const log = await FraudLog.findByIdAndUpdate(
      req.params.id,
      {
        reviewAction: action,
        reviewNote: note,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
      },
      { new: true },
    );

    if (!log)
      return res
        .status(404)
        .json({ success: false, message: "Fraud log not found" });

    // If rejected, auto-cancel the order
    if (action === "rejected") {
      await Order.findByIdAndUpdate(log.order, { orderStatus: "cancelled" });
      console.log(
        `🚫 [FRAUD] Order cancelled after fraud review: ${log.orderNumber}`,
      );
    }

    res.json({
      success: true,
      data: log,
      message: `Fraud log marked as ${action}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get fraud dashboard stats
// @route   GET /api/fraud/stats
// @access  Private (Admin)
const getFraudStats = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      blockedToday,
      reviewPending,
      avgScoreResult,
      verdictBreakdown,
      topFlags,
      scoreDistribution,
      trend,
    ] = await Promise.all([
      FraudLog.countDocuments(),
      FraudLog.countDocuments({
        verdict: "blocked",
        createdAt: { $gte: today },
      }),
      FraudLog.countDocuments({
        verdict: { $in: ["review", "blocked"] },
        reviewAction: null,
      }),
      FraudLog.aggregate([
        { $group: { _id: null, avg: { $avg: "$riskScore" } } },
      ]),
      FraudLog.aggregate([{ $group: { _id: "$verdict", count: { $sum: 1 } } }]),
      // Top triggered flags in last 30 days
      FraudLog.aggregate([
        { $match: { createdAt: { $gte: month } } },
        { $unwind: "$allFlags" },
        { $group: { _id: "$allFlags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      // Score buckets: 0-30, 31-60, 61-100
      FraudLog.aggregate([
        {
          $bucket: {
            groupBy: "$riskScore",
            boundaries: [0, 31, 61, 101],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      // Daily blocked count for past 7 days
      FraudLog.aggregate([
        {
          $match: {
            createdAt: { $gte: week },
            verdict: { $in: ["blocked", "review"] },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Dhaka",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        blockedToday,
        reviewPending,
        avgRiskScore: Math.round(avgScoreResult[0]?.avg || 0),
        verdictBreakdown: verdictBreakdown.reduce((acc, v) => {
          acc[v._id] = v.count;
          return acc;
        }, {}),
        topFlags,
        scoreDistribution,
        trend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get risk profile for a customer (phone/email)
// @route   GET /api/fraud/customer-risk
// @access  Private (Admin)
const getCustomerRisk = async (req, res) => {
  try {
    const { phone, email } = req.query;
    if (!phone && !email) {
      return res
        .status(400)
        .json({ success: false, message: "Provide phone or email" });
    }

    const orderQuery = phone
      ? { "customer.phone": phone }
      : { "customer.email": email };

    const orders = await Order.find(orderQuery).lean();
    if (!orders.length) {
      return res.json({
        success: true,
        data: { riskLevel: "unknown", message: "No order history" },
      });
    }

    const orderIds = orders.map((o) => o._id);
    const fraudLogs = await FraudLog.find({ order: { $in: orderIds } }).lean();

    const cancelledCount = orders.filter((o) =>
      ["cancelled", "returned"].includes(o.orderStatus),
    ).length;

    const avgScore = fraudLogs.length
      ? Math.round(
          fraudLogs.reduce((s, l) => s + l.riskScore, 0) / fraudLogs.length,
        )
      : 0;

    const maxScore = fraudLogs.length
      ? Math.max(...fraudLogs.map((l) => l.riskScore))
      : 0;

    const blockedCount = fraudLogs.filter(
      (l) => l.verdict === "blocked",
    ).length;
    const allFlags = [...new Set(fraudLogs.flatMap((l) => l.allFlags))];

    let riskLevel = "low";
    if (maxScore > 60 || blockedCount > 0) riskLevel = "high";
    else if (avgScore > 30 || cancelledCount >= 2) riskLevel = "medium";

    res.json({
      success: true,
      data: {
        totalOrders: orders.length,
        cancelledCount,
        avgRiskScore: avgScore,
        maxRiskScore: maxScore,
        blockedCount,
        riskLevel,
        uniqueFlags: allFlags.slice(0, 10),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get fraud status for multiple orders at once
// @route   POST /api/fraud/status-batch
// @access  Private (Admin)
const getFraudStatusBatch = async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds?.length) return res.json({ success: true, data: {} });

    const logs = await FraudLog.find({
      order: { $in: orderIds },
    })
      .select("order riskScore verdict reviewAction allFlags autoAction")
      .lean();

    // Build a map: { orderId: fraudData }
    const map = {};
    logs.forEach((log) => {
      map[String(log.order)] = {
        riskScore: log.riskScore,
        verdict: log.verdict,
        reviewAction: log.reviewAction,
        topFlag: log.allFlags?.[0] || null,
        autoAction: log.autoAction,
        logId: log._id,
      };
    });

    res.json({ success: true, data: map });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  analyzeOrderById,
  bulkScan,
  getFraudLogs,
  getFraudLog,
  reviewFraudLog,
  getFraudStats,
  getCustomerRisk,
  getFraudStatusBatch,
};
