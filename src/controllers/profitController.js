const Order = require("../models/Order");
const Product = require("../models/Product");
const ProfitSnapshot = require("../models/ProfitSnapshot");

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ── Timezone-aware period bounds ──────────────────────────────────────────────
const TIMEZONE_OFFSET_HOURS = 6; // Bangladesh UTC+6

const getPeriodBounds = (period, date = new Date()) => {
  // Get the UTC timestamp of the local date boundaries
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Helper: Convert local date components to UTC Date object correctly
  const toUTCStartOfDay = (y, m, d) => {
    // Create a date in local timezone, then convert to UTC midnight
    const localDate = new Date(y, m, d, 0, 0, 0, 0);
    // Return UTC timestamp of that local midnight
    return new Date(
      localDate.getTime() - TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000,
    );
  };

  const toUTCEndOfDay = (y, m, d) => {
    // Create a date in local timezone at end of day
    const localDate = new Date(y, m, d, 23, 59, 59, 999);
    // Return UTC timestamp of that local end-of-day
    return new Date(
      localDate.getTime() - TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000,
    );
  };

  if (period === "today") {
    const start = toUTCStartOfDay(year, month, day);
    const end = toUTCEndOfDay(year, month, day);
    console.log(
      `[PROFIT] today: ${start.toISOString()} → ${end.toISOString()}`,
    );
    return { start, end };
  }

  if (period === "week") {
    // Get day of week (0 = Sunday)
    let dayOfWeek = date.getDay();
    // Calculate days to subtract to get to Monday (Monday = 1)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const mondayDate = new Date(year, month, day - daysToMonday);
    const sundayDate = new Date(year, month, day - daysToMonday + 6);

    const start = toUTCStartOfDay(
      mondayDate.getFullYear(),
      mondayDate.getMonth(),
      mondayDate.getDate(),
    );
    const end = toUTCEndOfDay(
      sundayDate.getFullYear(),
      sundayDate.getMonth(),
      sundayDate.getDate(),
    );

    console.log(`[PROFIT] week: ${start.toISOString()} → ${end.toISOString()}`);
    return { start, end };
  }

  if (period === "month") {
    const start = toUTCStartOfDay(year, month, 1);
    const end = toUTCEndOfDay(year, month + 1, 0);
    return { start, end };
  }

  if (period === "year") {
    const start = toUTCStartOfDay(year, 0, 1);
    const end = toUTCEndOfDay(year, 11, 31);
    return { start, end };
  }

  return null;
};

// ─── Build profit snapshot from an order ─────────────────────────────────────

const buildSnapshot = async (order) => {
  const productIds = order.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("costPerUnit packagingCost name sku")
    .lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  let productCost = 0;
  let packagingCost = 0;
  const itemBreakdown = [];

  for (const item of order.items) {
    const prod = productMap.get(item.product?.toString()) || {};
    const costPerUnit = prod.costPerUnit || 0;
    const packCostPerUnit = prod.packagingCost || 0;

    const itemRevenue = item.total;
    const itemCost = (costPerUnit + packCostPerUnit) * item.quantity;
    const itemProfit = itemRevenue - itemCost;

    productCost += costPerUnit * item.quantity;
    packagingCost += packCostPerUnit * item.quantity;

    itemBreakdown.push({
      product: item.product,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      sellingPrice: item.price,
      costPerUnit,
      packagingCostPerUnit: packCostPerUnit,
      itemRevenue,
      itemCost,
      itemProfit,
    });
  }

  // Delivery cost = what we pay the courier = order.deliveryCharge (our cost)
  // In many BD e-commerce setups, the delivery charge collected = delivery cost paid.
  // You can override this if you have a separate courier cost field later.
  const deliveryCost = order.deliveryCharge || 0;
  const totalCost = productCost + packagingCost + deliveryCost;
  const totalRevenue = order.total;
  const grossProfit = totalRevenue - totalCost;
  const profitMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    order: order._id,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    deliveredAt: order.deliveryDate || null,
    subtotal: order.subtotal,
    deliveryRevenue: order.deliveryCharge || 0,
    discount: order.discount || 0,
    totalRevenue,
    productCost,
    packagingCost,
    deliveryCost,
    totalCost,
    grossProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    items: itemBreakdown,
    orderStatus: order.orderStatus,
    isRealized: order.orderStatus === "delivered",
  };
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @desc   Sync profit snapshot for a single order (called internally or via admin)
 * @route  POST /api/profit/sync/:orderId
 * @access Private
 */
const syncOrderProfit = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const snapshot = await buildSnapshot(order);

    const result = await ProfitSnapshot.findOneAndUpdate(
      { order: order._id },
      snapshot,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    console.log(`✅ [PROFIT] Snapshot synced for ${order.orderNumber}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ [PROFIT] Sync error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Bulk sync all delivered orders that don't have snapshots yet
 * @route  POST /api/profit/sync-all
 * @access Private
 */
const syncAllProfit = async (req, res) => {
  try {
    console.log("🔄 [PROFIT] Starting bulk sync...");

    // ✅ CHANGED: sync ALL orders, not just ones without snapshots
    const ordersToSync = await Order.find({}).lean();

    console.log(`📦 [PROFIT] ${ordersToSync.length} orders to sync`);

    let synced = 0;
    let failed = 0;

    for (const order of ordersToSync) {
      try {
        const snapshot = await buildSnapshot(order);
        // ✅ upsert: updates existing snapshots with corrected dates
        await ProfitSnapshot.findOneAndUpdate({ order: order._id }, snapshot, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        });
        synced++;
      } catch (err) {
        console.error(
          `❌ [PROFIT] Failed for ${order.orderNumber}:`,
          err.message,
        );
        failed++;
      }
    }

    console.log(
      `✅ [PROFIT] Bulk sync done: ${synced} synced, ${failed} failed`,
    );
    res.json({
      success: true,
      message: `Sync complete: ${synced} synced, ${failed} failed`,
      synced,
      failed,
    });
  } catch (error) {
    console.error("❌ [PROFIT] Bulk sync error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get profit summary (today / this week / this month / this year / all-time)
 * @route  GET /api/profit/summary?period=month
 * @access Private
 */
const getProfitSummary = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;

    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter = {
        orderDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
    } else if (period !== "all") {
      const bounds = getPeriodBounds(period);
      if (bounds) {
        dateFilter = { orderDate: { $gte: bounds.start, $lte: bounds.end } };
      }
    }

    console.log(`📊 [PROFIT] Summary for period: ${period}`);

    const [realizedStats, pendingStats, topProducts] = await Promise.all([
      // Realized profit (delivered orders only)
      ProfitSnapshot.aggregate([
        { $match: { ...dateFilter, isRealized: true } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalRevenue" },
            totalProductCost: { $sum: "$productCost" },
            totalPackagingCost: { $sum: "$packagingCost" },
            totalDeliveryCost: { $sum: "$deliveryCost" },
            totalCost: { $sum: "$totalCost" },
            grossProfit: { $sum: "$grossProfit" },
            totalDiscount: { $sum: "$discount" },
            orderCount: { $sum: 1 },
          },
        },
      ]),

      // Projected profit (all non-cancelled orders)
      ProfitSnapshot.aggregate([
        {
          $match: {
            ...dateFilter,
            orderStatus: { $nin: ["cancelled"] },
          },
        },
        {
          $group: {
            _id: null,
            projectedRevenue: { $sum: "$totalRevenue" },
            projectedProfit: { $sum: "$grossProfit" },
            projectedCost: { $sum: "$totalCost" },
            orderCount: { $sum: 1 },
          },
        },
      ]),

      // Top 5 most profitable products in this period
      ProfitSnapshot.aggregate([
        { $match: { ...dateFilter, isRealized: true } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            totalRevenue: { $sum: "$items.itemRevenue" },
            totalCost: { $sum: "$items.itemCost" },
            totalProfit: { $sum: "$items.itemProfit" },
            unitsSold: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalProfit: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const realized = realizedStats[0] || {
      totalRevenue: 0,
      totalProductCost: 0,
      totalPackagingCost: 0,
      totalDeliveryCost: 0,
      totalCost: 0,
      grossProfit: 0,
      totalDiscount: 0,
      orderCount: 0,
    };

    const projected = pendingStats[0] || {
      projectedRevenue: 0,
      projectedProfit: 0,
      projectedCost: 0,
      orderCount: 0,
    };

    const profitMargin =
      realized.totalRevenue > 0
        ? ((realized.grossProfit / realized.totalRevenue) * 100).toFixed(2)
        : 0;

    const avgProfitPerOrder =
      realized.orderCount > 0
        ? Math.round(realized.grossProfit / realized.orderCount)
        : 0;

    res.json({
      success: true,
      period,
      data: {
        realized: {
          ...realized,
          profitMargin: parseFloat(profitMargin),
          avgProfitPerOrder,
        },
        projected: {
          ...projected,
          projectedMargin:
            projected.projectedRevenue > 0
              ? (
                  (projected.projectedProfit / projected.projectedRevenue) *
                  100
                ).toFixed(2)
              : 0,
        },
        topProducts,
      },
    });
  } catch (error) {
    console.error("❌ [PROFIT] Summary error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get daily profit trend (last N days)
 * @route  GET /api/profit/daily?days=30
 * @access Private
 */
const getDailyProfit = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    console.log(`📈 [PROFIT] Daily trend for last ${days} days`);

    const dailyData = await ProfitSnapshot.aggregate([
      {
        $match: {
          orderDate: { $gte: since },
          isRealized: true,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$orderDate" },
            month: { $month: "$orderDate" },
            day: { $dayOfMonth: "$orderDate" },
          },
          revenue: { $sum: "$totalRevenue" },
          cost: { $sum: "$totalCost" },
          profit: { $sum: "$grossProfit" },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          revenue: 1,
          cost: 1,
          profit: 1,
          orders: 1,
          margin: {
            $cond: [
              { $gt: ["$revenue", 0] },
              { $multiply: [{ $divide: ["$profit", "$revenue"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({ success: true, days, data: dailyData });
  } catch (error) {
    console.error("❌ [PROFIT] Daily trend error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get monthly profit trend (last N months)
 * @route  GET /api/profit/monthly?months=12
 * @access Private
 */
const getMonthlyProfit = async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 12, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    console.log(`📅 [PROFIT] Monthly trend for last ${months} months`);

    const monthlyData = await ProfitSnapshot.aggregate([
      {
        $match: {
          orderDate: { $gte: since },
          isRealized: true,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$orderDate" },
            month: { $month: "$orderDate" },
          },
          revenue: { $sum: "$totalRevenue" },
          productCost: { $sum: "$productCost" },
          packagingCost: { $sum: "$packagingCost" },
          deliveryCost: { $sum: "$deliveryCost" },
          totalCost: { $sum: "$totalCost" },
          profit: { $sum: "$grossProfit" },
          orders: { $sum: 1 },
          discount: { $sum: "$discount" },
        },
      },
      {
        $project: {
          year: "$_id.year",
          month: "$_id.month",
          revenue: 1,
          productCost: 1,
          packagingCost: 1,
          deliveryCost: 1,
          totalCost: 1,
          profit: 1,
          orders: 1,
          discount: 1,
          margin: {
            $cond: [
              { $gt: ["$revenue", 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ["$profit", "$revenue"] }, 100] },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);

    res.json({ success: true, months, data: monthlyData });
  } catch (error) {
    console.error("❌ [PROFIT] Monthly trend error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get profit breakdown per product (all time or filtered)
 * @route  GET /api/profit/products?period=month
 * @access Private
 */
const getProductProfitBreakdown = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        orderDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
    } else if (period !== "all") {
      const bounds = getPeriodBounds(period);
      if (bounds)
        dateFilter = { orderDate: { $gte: bounds.start, $lte: bounds.end } };
    }

    console.log(`🏷️ [PROFIT] Product breakdown for period: ${period}`);

    const [products, totalCount] = await Promise.all([
      ProfitSnapshot.aggregate([
        { $match: { ...dateFilter, isRealized: true } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            unitsSold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.itemRevenue" },
            totalCost: { $sum: "$items.itemCost" },
            totalProfit: { $sum: "$items.itemProfit" },
            avgSellingPrice: { $avg: "$items.sellingPrice" },
            avgCostPerUnit: { $avg: "$items.costPerUnit" },
          },
        },
        {
          $addFields: {
            profitMargin: {
              $cond: [
                { $gt: ["$totalRevenue", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$totalProfit", "$totalRevenue"] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { totalProfit: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),

      ProfitSnapshot.aggregate([
        { $match: { ...dateFilter, isRealized: true } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product" } },
        { $count: "total" },
      ]),
    ]);

    const total = totalCount[0]?.total || 0;

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ [PROFIT] Product breakdown error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get profit for a single order
 * @route  GET /api/profit/order/:orderId
 * @access Private
 */
const getOrderProfit = async (req, res) => {
  try {
    let snapshot = await ProfitSnapshot.findOne({ order: req.params.orderId });

    // Auto-compute on-the-fly if not snapshotted yet
    if (!snapshot) {
      const order = await Order.findById(req.params.orderId).lean();
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      const data = await buildSnapshot(order);
      snapshot = new ProfitSnapshot(data);
      // Don't save yet — it will be saved on next sync-all or when order is delivered
    }

    res.json({ success: true, data: snapshot });
  } catch (error) {
    console.error("❌ [PROFIT] Order profit error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Update product cost info (costPerUnit, packagingCost)
 * @route  PATCH /api/profit/products/:productId/costs
 * @access Private
 */
const updateProductCosts = async (req, res) => {
  try {
    const { costPerUnit, packagingCost } = req.body;
    const Product = require("../models/Product");

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (costPerUnit !== undefined)
      product.costPerUnit = Math.max(0, parseFloat(costPerUnit) || 0);
    if (packagingCost !== undefined)
      product.packagingCost = Math.max(0, parseFloat(packagingCost) || 0);

    await product.save();

    // Calculate implied margin
    const totalCost = product.costPerUnit + product.packagingCost;
    const impliedMargin =
      product.price > 0
        ? (((product.price - totalCost) / product.price) * 100).toFixed(2)
        : 0;

    console.log(
      `✅ [PROFIT] Cost updated for "${product.name}" — cost: ${totalCost} ৳, margin: ${impliedMargin}%`,
    );

    res.json({
      success: true,
      data: {
        product: product._id,
        name: product.name,
        sellingPrice: product.price,
        costPerUnit: product.costPerUnit,
        packagingCost: product.packagingCost,
        totalCostPerUnit: totalCost,
        impliedMarginPercent: parseFloat(impliedMargin),
      },
    });
  } catch (error) {
    console.error("❌ [PROFIT] Update costs error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get cost info for all products (for the cost management table)
 * @route  GET /api/profit/products/costs
 * @access Private
 */
const getAllProductCosts = async (req, res) => {
  try {
    const Product = require("../models/Product");

    const products = await Product.find({ isActive: true })
      .select("name sku price costPerUnit packagingCost stock category")
      .populate("category", "name")
      .sort("name")
      .lean();

    const withMargins = products.map((p) => {
      const totalCost = (p.costPerUnit || 0) + (p.packagingCost || 0);
      const grossProfit = p.price - totalCost;
      const margin =
        p.price > 0 ? ((grossProfit / p.price) * 100).toFixed(2) : 0;
      return {
        ...p,
        totalCostPerUnit: totalCost,
        grossProfitPerUnit: grossProfit,
        impliedMarginPercent: parseFloat(margin),
        hasCostData: totalCost > 0,
      };
    });

    res.json({
      success: true,
      count: withMargins.length,
      data: withMargins,
    });
  } catch (error) {
    console.error("❌ [PROFIT] All product costs error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const syncSnapshotForOrder = async (order) => {
  const ProfitSnapshot = require("../models/ProfitSnapshot");
  const Product = require("../models/Product");

  try {
    // Re-fetch order from DB with full item data if needed
    const Order = require("../models/Order");
    const fullOrder = order.toObject ? order.toObject() : order;

    const productIds = fullOrder.items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("costPerUnit packagingCost")
      .lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let productCost = 0;
    let packagingCost = 0;
    const itemBreakdown = [];

    for (const item of fullOrder.items) {
      const prod = productMap.get(item.product?.toString()) || {};
      const costPerUnit = prod.costPerUnit || 0;
      const packCostPerUnit = prod.packagingCost || 0;

      const itemRevenue = item.total;
      const itemCost = (costPerUnit + packCostPerUnit) * item.quantity;

      productCost += costPerUnit * item.quantity;
      packagingCost += packCostPerUnit * item.quantity;

      itemBreakdown.push({
        product: item.product,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        sellingPrice: item.price,
        costPerUnit,
        packagingCostPerUnit: packCostPerUnit,
        itemRevenue,
        itemCost,
        itemProfit: itemRevenue - itemCost,
      });
    }

    const deliveryCost = fullOrder.deliveryCharge || 0;
    const totalCost = productCost + packagingCost + deliveryCost;
    const totalRevenue = fullOrder.total;
    const grossProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0
        ? Math.round((grossProfit / totalRevenue) * 10000) / 100
        : 0;

    await ProfitSnapshot.findOneAndUpdate(
      { order: fullOrder._id },
      {
        order: fullOrder._id,
        orderNumber: fullOrder.orderNumber,
        orderDate: fullOrder.createdAt,
        deliveredAt: fullOrder.deliveryDate || null,
        subtotal: fullOrder.subtotal,
        deliveryRevenue: fullOrder.deliveryCharge || 0,
        discount: fullOrder.discount || 0,
        totalRevenue,
        productCost,
        packagingCost,
        deliveryCost,
        totalCost,
        grossProfit,
        profitMargin,
        items: itemBreakdown,
        orderStatus: fullOrder.orderStatus,
        isRealized: fullOrder.orderStatus === "delivered",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return true;
  } catch (err) {
    console.error(`❌ [PROFIT] syncSnapshotForOrder failed:`, err.message);
    return false;
  }
};

module.exports = {
  syncOrderProfit,
  syncAllProfit,
  getProfitSummary,
  getDailyProfit,
  getMonthlyProfit,
  getProductProfitBreakdown,
  getOrderProfit,
  updateProductCosts,
  getAllProductCosts,
  syncSnapshotForOrder,
};
