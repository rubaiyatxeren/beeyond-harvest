const TrackerSession = require("../models/TrackerEvent");
const UAParser = require("ua-parser-js"); // npm i ua-parser-js

// ─── Parse user agent ─────────────────────────────────────────
function parseUA(uaString) {
  const parser = new UAParser(uaString);
  const r = parser.getResult();
  return {
    os: `${r.os.name || ""} ${r.os.version || ""}`.trim(),
    browser:
      `${r.browser.name || ""} ${r.browser.version?.split(".")[0] || ""}`.trim(),
    deviceType:
      r.device.type === "mobile"
        ? "mobile"
        : r.device.type === "tablet"
          ? "tablet"
          : "desktop",
  };
}

// ─── POST /api/track/events ───────────────────────────────────
// Replace your ingestEvents function with this fixed version:
const ingestEvents = async (req, res) => {
  try {
    const { sessionId, visitorId, device, events } = req.body;
    if (!sessionId || !events?.length) {
      return res
        .status(400)
        .json({ success: false, message: "sessionId and events required" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const parsed = parseUA(device?.userAgent || "");

    // Calculate new page count properly
    const pageViewCount = events.filter((e) => e.type === "page_view").length;

    // Get existing session to calculate page count increment
    const existingSession = await TrackerSession.findOne({ sessionId });
    const currentPageCount = existingSession?.pageCount || 0;

    await TrackerSession.findOneAndUpdate(
      { sessionId },
      {
        $setOnInsert: {
          sessionId,
          visitorId,
          ip,
          sessionStart: new Date(),
          device: {
            ...device,
            ...parsed,
          },
          pageCount: 0,
          eventCount: 0,
        },
        $push: { events: { $each: events } },
        $inc: {
          eventCount: events.length,
          pageCount: pageViewCount,
        },
        $set: {
          lastSeen: new Date(), // ← CRITICAL: This must be updated on EVERY event
          ip: ip,
        },
      },
      { upsert: true, new: true },
    );

    console.log(
      `✅ [TRACKER] Updated session ${sessionId.slice(-8)} with ${events.length} events, lastSeen: ${new Date().toISOString()}`,
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ [TRACKER] Ingest error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/track/sessions ──────────────────────────────────
// Admin: list recent sessions
const getSessions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.deviceType)
      filter["device.deviceType"] = req.query.deviceType;
    if (req.query.search) {
      filter.$or = [
        { sessionId: { $regex: req.query.search, $options: "i" } },
        { ip: { $regex: req.query.search, $options: "i" } },
        { linkedPhone: { $regex: req.query.search, $options: "i" } },
        { linkedOrderNumber: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [sessions, total] = await Promise.all([
      TrackerSession.find(filter)
        .select("-events") // exclude full event array for list view
        .sort({ lastSeen: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrackerSession.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("❌ [TRACKER] Sessions error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/track/sessions/:sessionId ───────────────────────
// Admin: full event timeline for one session
const getSessionDetail = async (req, res) => {
  try {
    const session = await TrackerSession.findOne({
      sessionId: req.params.sessionId,
    }).lean();

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // Sort events by ts ascending
    session.events = (session.events || []).sort(
      (a, b) => new Date(a.ts) - new Date(b.ts),
    );

    res.json({ success: true, data: session });
  } catch (err) {
    console.error("❌ [TRACKER] Session detail error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/track/stats ─────────────────────────────────────
// Admin: aggregate stats (today / 7d / 30d)
const getStats = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d7 = new Date(now - 7 * 86400000);
    const d30 = new Date(now - 30 * 86400000);

    const [todayCount, d7Count, d30Count, deviceBreakdown, topEvents] =
      await Promise.all([
        TrackerSession.countDocuments({ lastSeen: { $gte: today } }),
        TrackerSession.countDocuments({ lastSeen: { $gte: d7 } }),
        TrackerSession.countDocuments({ lastSeen: { $gte: d30 } }),
        TrackerSession.aggregate([
          { $group: { _id: "$device.deviceType", count: { $sum: 1 } } },
        ]),
        TrackerSession.aggregate([
          { $unwind: "$events" },
          { $group: { _id: "$events.type", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    res.json({
      success: true,
      data: { todayCount, d7Count, d30Count, deviceBreakdown, topEvents },
    });
  } catch (err) {
    console.error("❌ [TRACKER] Stats error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/track/sessions/:sessionId/link ────────────────
// Link a session to an order number or phone (called internally after order success)
const linkSession = async (req, res) => {
  try {
    const { orderNumber, phone } = req.body;
    await TrackerSession.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { linkedOrderNumber: orderNumber, linkedPhone: phone } },
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add this function to your existing trackController.js
// Replace your existing getActiveVisitorCount function with this:
const getActiveVisitorCount = async (req, res) => {
  try {
    // Active sessions are those with lastSeen in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Count sessions that have been active recently
    const activeCount = await TrackSession.countDocuments({
      lastSeen: { $gte: fiveMinutesAgo },
    });

    // Also get the most recent sessions for debugging
    const recentSessions = await TrackSession.find({
      lastSeen: { $gte: fiveMinutesAgo },
    })
      .limit(5)
      .select("sessionId lastSeen");

    console.log(`🔴 Active sessions in last 5 min: ${activeCount}`);
    console.log(
      `📊 Recent sessions:`,
      recentSessions.map((s) => ({
        id: s.sessionId?.slice(-8),
        lastSeen: s.lastSeen,
      })),
    );

    res.json({
      success: true,
      data: {
        activeCount: activeCount,
        timestamp: new Date().toISOString(),
        recentSessions: recentSessions.map((s) => s.sessionId),
      },
    });
  } catch (error) {
    console.error("Error getting active visitor count:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  ingestEvents,
  getSessions,
  getSessionDetail,
  getStats,
  linkSession,
  getActiveVisitorCount,
};
