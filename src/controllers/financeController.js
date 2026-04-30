const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Order = require("../models/Order");
const ProfitSnapshot = require("../models/ProfitSnapshot");

// ─── Timezone Helper ──────────────────────────────────────────────────────────
const TZ_OFFSET = 6; // UTC+6 Bangladesh

const toUTC = (y, m, d, endOfDay = false) => {
  const h = endOfDay ? 23 : 0,
    min = endOfDay ? 59 : 0,
    s = endOfDay ? 59 : 0,
    ms = endOfDay ? 999 : 0;
  const local = new Date(y, m, d, h, min, s, ms);
  return new Date(local.getTime() - TZ_OFFSET * 3600 * 1000);
};

const getPeriodBounds = (period, refDate = new Date()) => {
  const y = refDate.getFullYear(),
    mo = refDate.getMonth(),
    d = refDate.getDate();
  switch (period) {
    case "today":
      return { start: toUTC(y, mo, d), end: toUTC(y, mo, d, true) };
    case "yesterday": {
      const yest = new Date(y, mo, d - 1);
      return {
        start: toUTC(yest.getFullYear(), yest.getMonth(), yest.getDate()),
        end: toUTC(yest.getFullYear(), yest.getMonth(), yest.getDate(), true),
      };
    }
    case "week": {
      const dow = refDate.getDay();
      const mon = new Date(y, mo, d - (dow === 0 ? 6 : dow - 1));
      const sun = new Date(
        mon.getFullYear(),
        mon.getMonth(),
        mon.getDate() + 6,
      );
      return {
        start: toUTC(mon.getFullYear(), mon.getMonth(), mon.getDate()),
        end: toUTC(sun.getFullYear(), sun.getMonth(), sun.getDate(), true),
      };
    }
    case "month":
      return { start: toUTC(y, mo, 1), end: toUTC(y, mo + 1, 0, true) };
    case "quarter": {
      const qStart = Math.floor(mo / 3) * 3;
      return { start: toUTC(y, qStart, 1), end: toUTC(y, qStart + 3, 0, true) };
    }
    case "year":
      return { start: toUTC(y, 0, 1), end: toUTC(y, 11, 31, true) };
    default:
      return null;
  }
};

// ─── Default Categories ───────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATEGORIES = [
  "Product Purchase",
  "Packaging Materials",
  "Delivery Cost",
  "Marketing & Ads",
  "Salary & Wages",
  "Office Rent",
  "Utilities",
  "Internet & Phone",
  "Software & Tools",
  "Equipment",
  "Maintenance & Repair",
  "Taxes & Fees",
  "Refunds & Returns",
  "Miscellaneous",
];

const DEFAULT_INCOME_CATEGORIES = [
  "Sales Revenue",
  "Delivery Revenue",
  "Refund Recovery",
  "Investment",
  "Other Income",
];

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// @desc    Create transaction (income or expense)
// @route   POST /api/finance/transactions
// @access  Private
const createTransaction = async (req, res) => {
  try {
    const data = { ...req.body };

    // Auto-link to order if referenceType=order and referenceNumber provided
    if (
      data.referenceType === "order" &&
      data.referenceNumber &&
      !data.referenceId
    ) {
      const Order = require("../models/Order");
      const order = await Order.findOne({
        orderNumber: data.referenceNumber.toUpperCase(),
      }).lean();
      if (order) data.referenceId = order._id;
    }

    const transaction = await Transaction.create(data);
    console.log(
      `✅ [FINANCE] Transaction created: ${transaction.type} — ${transaction.title} — ৳${transaction.amount}`,
    );

    // Update budget spent if budgetId provided
    if (transaction.type === "expense" && transaction.budgetId) {
      await checkBudgetAlert(transaction.budgetId, transaction.amount);
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error("❌ [FINANCE] Create transaction error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all transactions with filters + pagination
// @route   GET /api/finance/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const query = {};

    // Filters
    if (req.query.type) query.type = req.query.type;
    if (req.query.category) query.category = req.query.category;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    if (req.query.status) query.status = req.query.status;
    if (req.query.referenceType) query.referenceType = req.query.referenceType;

    // Date range
    if (req.query.period && req.query.period !== "all") {
      const bounds = getPeriodBounds(req.query.period);
      if (bounds) query.date = { $gte: bounds.start, $lte: bounds.end };
    } else if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
    }

    // Amount range
    if (req.query.minAmount || req.query.maxAmount) {
      query.amount = {};
      if (req.query.minAmount)
        query.amount.$gte = parseFloat(req.query.minAmount);
      if (req.query.maxAmount)
        query.amount.$lte = parseFloat(req.query.maxAmount);
    }

    // Text search
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { referenceNumber: { $regex: req.query.search, $options: "i" } },
        { "party.name": { $regex: req.query.search, $options: "i" } },
        { tags: { $in: [new RegExp(req.query.search, "i")] } },
      ];
    }

    // Tag filter
    if (req.query.tag) query.tags = req.query.tag;

    const sortField = req.query.sortBy || "date";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ [sortField]: sortOrder, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    // Totals for the current filter set
    const totals = await Transaction.aggregate([
      { $match: { ...query, status: { $in: ["approved", "pending"] } } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalsMap = { income: 0, expense: 0, transfer: 0 };
    totals.forEach((t) => {
      totalsMap[t._id] = t.total;
    });

    res.json({
      success: true,
      data: transactions,
      summary: {
        totalIncome: totalsMap.income,
        totalExpense: totalsMap.expense,
        netBalance: totalsMap.income - totalsMap.expense,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("❌ [FINANCE] Get transactions error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single transaction
// @route   GET /api/finance/transactions/:id
// @access  Private
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction)
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/finance/transactions/:id
// @access  Private
const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction)
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });

    // Prevent editing voided
    if (transaction.status === "void") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot edit a voided transaction" });
    }

    const updated = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    console.log(`✅ [FINANCE] Transaction updated: ${updated._id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Void (soft delete) transaction
// @route   DELETE /api/finance/transactions/:id
// @access  Private
const voidTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction)
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });

    transaction.status = "void";
    await transaction.save();

    console.log(`✅ [FINANCE] Transaction voided: ${transaction._id}`);
    res.json({ success: true, message: "Transaction voided successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk create transactions
// @route   POST /api/finance/transactions/bulk
// @access  Private
const bulkCreateTransactions = async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || !transactions.length) {
      return res
        .status(400)
        .json({ success: false, message: "transactions array required" });
    }
    const created = await Transaction.insertMany(transactions, {
      ordered: false,
    });
    res
      .status(201)
      .json({ success: true, count: created.length, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────

// @desc    Get financial dashboard summary
// @route   GET /api/finance/summary?period=month
// @access  Private
const getFinanceSummary = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const bounds = getPeriodBounds(period);
    const dateFilter = bounds
      ? { date: { $gte: bounds.start, $lte: bounds.end } }
      : {};
    const approvedFilter = { status: { $in: ["approved"] } };

    console.log(`📊 [FINANCE] Summary for period: ${period}`);

    // Previous period for comparison
    const prevBounds = getPreviousPeriodBounds(period, bounds);
    const prevDateFilter = prevBounds
      ? { date: { $gte: prevBounds.start, $lte: prevBounds.end } }
      : {};

    const [
      currentPeriod,
      previousPeriod,
      categoryBreakdown,
      paymentMethodBreakdown,
      topExpenses,
      topIncome,
      dailyTrend,
      orderIncomeSummary,
    ] = await Promise.all([
      // Current period totals
      Transaction.aggregate([
        { $match: { ...dateFilter, ...approvedFilter } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
          },
        },
      ]),

      // Previous period totals
      Transaction.aggregate([
        { $match: { ...prevDateFilter, ...approvedFilter } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),

      // Category breakdown (expenses only)
      Transaction.aggregate([
        { $match: { ...dateFilter, ...approvedFilter, type: "expense" } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),

      // Payment method breakdown
      Transaction.aggregate([
        { $match: { ...dateFilter, ...approvedFilter } },
        {
          $group: {
            _id: { type: "$type", method: "$paymentMethod" },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Top 5 expenses
      Transaction.find({ ...dateFilter, ...approvedFilter, type: "expense" })
        .sort({ amount: -1 })
        .limit(5)
        .select("title amount category date referenceNumber")
        .lean(),

      // Top 5 income sources
      Transaction.find({ ...dateFilter, ...approvedFilter, type: "income" })
        .sort({ amount: -1 })
        .limit(5)
        .select("title amount category date referenceNumber")
        .lean(),

      // Daily trend (last 30 days or period)
      Transaction.aggregate([
        {
          $match: {
            ...dateFilter,
            ...approvedFilter,
            type: { $in: ["income", "expense"] },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$date",
                  timezone: "+06:00",
                },
              },
              type: "$type",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // Auto-compute income from delivered orders (cross-check)
      ProfitSnapshot.aggregate([
        bounds
          ? {
              $match: {
                orderDate: { $gte: bounds.start, $lte: bounds.end },
                isRealized: true,
              },
            }
          : { $match: { isRealized: true } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalRevenue" },
            totalProfit: { $sum: "$grossProfit" },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build maps
    const curr = {},
      prev = {};
    currentPeriod.forEach((r) => (curr[r._id] = r));
    previousPeriod.forEach((r) => (prev[r._id] = r));

    const totalIncome = curr.income?.total || 0;
    const totalExpense = curr.expense?.total || 0;
    const netBalance = totalIncome - totalExpense;

    const prevIncome = prev.income?.total || 0;
    const prevExpense = prev.expense?.total || 0;

    const incomeChange =
      prevIncome > 0
        ? (((totalIncome - prevIncome) / prevIncome) * 100).toFixed(1)
        : null;
    const expenseChange =
      prevExpense > 0
        ? (((totalExpense - prevExpense) / prevExpense) * 100).toFixed(1)
        : null;

    // Pivot daily trend
    const dailyMap = {};
    dailyTrend.forEach(({ _id, total }) => {
      const { date, type } = _id;
      if (!dailyMap[date]) dailyMap[date] = { date, income: 0, expense: 0 };
      dailyMap[date][type] = total;
    });
    const trendData = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    res.json({
      success: true,
      period,
      data: {
        overview: {
          totalIncome,
          totalExpense,
          netBalance,
          incomeCount: curr.income?.count || 0,
          expenseCount: curr.expense?.count || 0,
          avgIncome: curr.income?.avgAmount
            ? Math.round(curr.income.avgAmount)
            : 0,
          avgExpense: curr.expense?.avgAmount
            ? Math.round(curr.expense.avgAmount)
            : 0,
          incomeChangePercent: incomeChange ? parseFloat(incomeChange) : null,
          expenseChangePercent: expenseChange
            ? parseFloat(expenseChange)
            : null,
        },
        categoryBreakdown,
        paymentMethodBreakdown,
        topExpenses,
        topIncome,
        dailyTrend: trendData,
        orderSales: orderIncomeSummary[0] || {
          totalRevenue: 0,
          totalProfit: 0,
          orderCount: 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ [FINANCE] Summary error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: get previous period bounds
function getPreviousPeriodBounds(period, currentBounds) {
  if (!currentBounds) return null;
  const duration = currentBounds.end - currentBounds.start;
  return {
    start: new Date(currentBounds.start.getTime() - duration),
    end: new Date(currentBounds.end.getTime() - duration),
  };
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

// @desc    Monthly P&L statement
// @route   GET /api/finance/pnl?months=12
// @access  Private
const getPnLStatement = async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 12, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [transactions, orderSnapshots] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            date: { $gte: since },
            status: "approved",
            type: { $in: ["income", "expense"] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { date: "$date", timezone: "+06:00" } },
              month: { $month: { date: "$date", timezone: "+06:00" } },
              type: "$type",
              category: "$category",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      ProfitSnapshot.aggregate([
        { $match: { orderDate: { $gte: since }, isRealized: true } },
        {
          $group: {
            _id: {
              year: { $year: "$orderDate" },
              month: { $month: "$orderDate" },
            },
            salesRevenue: { $sum: "$totalRevenue" },
            productCost: { $sum: "$productCost" },
            packagingCost: { $sum: "$packagingCost" },
            deliveryCost: { $sum: "$deliveryCost" },
            grossProfit: { $sum: "$grossProfit" },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    // Build monthly P&L
    const monthMap = {};
    const key = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

    // From order snapshots
    orderSnapshots.forEach((s) => {
      const k = key(s._id.year, s._id.month);
      if (!monthMap[k]) monthMap[k] = initMonthEntry(s._id.year, s._id.month);
      monthMap[k].salesRevenue = s.salesRevenue;
      monthMap[k].cogsProduct = s.productCost;
      monthMap[k].cogsPackaging = s.packagingCost;
      monthMap[k].cogsDelivery = s.deliveryCost;
      monthMap[k].grossProfit = s.grossProfit;
      monthMap[k].orderCount = s.orderCount;
    });

    // From manual transactions
    transactions.forEach((t) => {
      const k = key(t._id.year, t._id.month);
      if (!monthMap[k]) monthMap[k] = initMonthEntry(t._id.year, t._id.month);
      if (t._id.type === "income") {
        monthMap[k].otherIncome += t.total;
        monthMap[k].incomeByCategory[t._id.category] =
          (monthMap[k].incomeByCategory[t._id.category] || 0) + t.total;
      } else {
        monthMap[k].operatingExpenses += t.total;
        monthMap[k].expenseByCategory[t._id.category] =
          (monthMap[k].expenseByCategory[t._id.category] || 0) + t.total;
      }
    });

    // Calculate net profit for each month
    const pnl = Object.values(monthMap)
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      .map((m) => {
        const totalIncome = m.salesRevenue + m.otherIncome;
        const totalExpense =
          m.cogsProduct +
          m.cogsPackaging +
          m.cogsDelivery +
          m.operatingExpenses;
        const netProfit = totalIncome - totalExpense;
        const netMargin =
          totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
        return {
          ...m,
          totalIncome,
          totalExpense,
          netProfit,
          netMargin: parseFloat(netMargin),
        };
      });

    res.json({ success: true, months, data: pnl });
  } catch (error) {
    console.error("❌ [FINANCE] P&L error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

function initMonthEntry(year, month) {
  return {
    year,
    month,
    label: new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    }),
    salesRevenue: 0,
    cogsProduct: 0,
    cogsPackaging: 0,
    cogsDelivery: 0,
    grossProfit: 0,
    orderCount: 0,
    otherIncome: 0,
    operatingExpenses: 0,
    incomeByCategory: {},
    expenseByCategory: {},
  };
}

// @desc    Category-level spending analysis
// @route   GET /api/finance/analytics/categories?type=expense&period=month
// @access  Private
const getCategoryAnalytics = async (req, res) => {
  try {
    const { type = "expense", period = "month" } = req.query;
    const bounds = getPeriodBounds(period);
    const dateFilter = bounds
      ? { date: { $gte: bounds.start, $lte: bounds.end } }
      : {};

    // Compare with previous period
    const prevBounds = getPreviousPeriodBounds(period, bounds);
    const prevDateFilter = prevBounds
      ? { date: { $gte: prevBounds.start, $lte: prevBounds.end } }
      : {};

    const [current, previous] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...dateFilter, type, status: "approved" } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
            subcategories: { $addToSet: "$subcategory" },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { ...prevDateFilter, type, status: "approved" } },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
      ]),
    ]);

    const prevMap = {};
    previous.forEach((p) => (prevMap[p._id] = p.total));

    const grandTotal = current.reduce((s, c) => s + c.total, 0);
    const categories = current.map((c) => ({
      category: c._id,
      total: c.total,
      count: c.count,
      avgAmount: Math.round(c.avgAmount),
      percentage:
        grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0,
      prevTotal: prevMap[c._id] || 0,
      changePercent: prevMap[c._id]
        ? (((c.total - prevMap[c._id]) / prevMap[c._id]) * 100).toFixed(1)
        : null,
    }));

    res.json({ success: true, type, period, grandTotal, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cash flow projection (next 30 days from recurring)
// @route   GET /api/finance/cashflow
// @access  Private
const getCashFlowProjection = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 3600 * 1000);

    // Get current balance
    const [currentBalance] = await Transaction.aggregate([
      { $match: { status: "approved", type: { $in: ["income", "expense"] } } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ["$type", "income"] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      },
    ]);

    // Get recurring transactions
    const recurring = await Transaction.find({
      isRecurring: true,
      status: "approved",
      recurringInterval: { $ne: null },
    }).lean();

    // Project future cash flows
    const projections = [];
    let runningBalance = currentBalance?.balance || 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() + i * 24 * 3600 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dailyItems = [];

      recurring.forEach((t) => {
        const isDue = isRecurringDue(t, date);
        if (isDue) {
          const amount = t.type === "income" ? t.amount : -t.amount;
          runningBalance += amount;
          dailyItems.push({
            title: t.title,
            type: t.type,
            amount: t.amount,
            category: t.category,
            isRecurring: true,
          });
        }
      });

      if (dailyItems.length > 0 || i === 0 || i === days - 1) {
        projections.push({
          date: dateStr,
          items: dailyItems,
          runningBalance: Math.round(runningBalance),
        });
      }
    }

    res.json({
      success: true,
      currentBalance: Math.round(currentBalance?.balance || 0),
      days,
      projections,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function isRecurringDue(transaction, date) {
  const lastDate = new Date(transaction.date);
  const diffDays = Math.round((date - lastDate) / (24 * 3600 * 1000));
  switch (transaction.recurringInterval) {
    case "daily":
      return diffDays > 0 && diffDays % 1 === 0;
    case "weekly":
      return diffDays > 0 && diffDays % 7 === 0;
    case "monthly":
      return date.getDate() === lastDate.getDate() && date > lastDate;
    case "yearly":
      return (
        date.getDate() === lastDate.getDate() &&
        date.getMonth() === lastDate.getMonth() &&
        date > lastDate
      );
    default:
      return false;
  }
}

// ─── BUDGET ───────────────────────────────────────────────────────────────────

// @desc    Create budget
// @route   POST /api/finance/budgets
// @access  Private
const createBudget = async (req, res) => {
  try {
    const budget = await Budget.create(req.body);
    res.status(201).json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all budgets with spending progress
// @route   GET /api/finance/budgets
// @access  Private
const getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ isActive: true }).lean();

    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await Transaction.aggregate([
          {
            $match: {
              type: "expense",
              category: budget.category,
              status: "approved",
              date: {
                $gte: new Date(budget.startDate),
                $lte: new Date(budget.endDate),
              },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        const totalSpent = spent[0]?.total || 0;
        const remaining = budget.amount - totalSpent;
        const percentage =
          budget.amount > 0
            ? ((totalSpent / budget.amount) * 100).toFixed(1)
            : 0;
        const isOverBudget = totalSpent > budget.amount;
        const isNearLimit = parseFloat(percentage) >= budget.alertThreshold;

        return {
          ...budget,
          totalSpent,
          remaining,
          percentage: parseFloat(percentage),
          isOverBudget,
          isNearLimit,
        };
      }),
    );

    res.json({ success: true, data: budgetsWithProgress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update budget
// @route   PUT /api/finance/budgets/:id
// @access  Private
const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!budget)
      return res
        .status(404)
        .json({ success: false, message: "Budget not found" });
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete budget
// @route   DELETE /api/finance/budgets/:id
// @access  Private
const deleteBudget = async (req, res) => {
  try {
    await Budget.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Budget deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function checkBudgetAlert(budgetId, newAmount) {
  try {
    const budget = await Budget.findById(budgetId).lean();
    if (!budget) return;
    const spent = await Transaction.aggregate([
      {
        $match: {
          type: "expense",
          category: budget.category,
          status: "approved",
          date: {
            $gte: new Date(budget.startDate),
            $lte: new Date(budget.endDate),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalSpent = (spent[0]?.total || 0) + newAmount;
    const pct = (totalSpent / budget.amount) * 100;
    if (pct >= budget.alertThreshold) {
      console.warn(
        `⚠️ [BUDGET] "${budget.name}" is at ${pct.toFixed(0)}% (৳${totalSpent} / ৳${budget.amount})`,
      );
    }
  } catch (err) {
    console.error("❌ [BUDGET] Alert check failed:", err.message);
  }
}

// ─── AUTO-IMPORT FROM ORDERS ──────────────────────────────────────────────────

// @desc    Import income from delivered orders as transactions
// @route   POST /api/finance/import/orders
// @access  Private
const importOrderIncome = async (req, res) => {
  try {
    const { startDate, endDate, overwrite = false } = req.body;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const snapshots = await ProfitSnapshot.find({
      isRealized: true,
      ...(Object.keys(dateFilter).length ? { orderDate: dateFilter } : {}),
    }).lean();

    let created = 0,
      skipped = 0;

    for (const snap of snapshots) {
      const existing = await Transaction.findOne({
        referenceType: "order",
        referenceId: snap.order,
      });
      if (existing && !overwrite) {
        skipped++;
        continue;
      }

      const transactionData = {
        type: "income",
        title: `Sales — Order ${snap.orderNumber}`,
        amount: snap.totalRevenue,
        category: "Sales Revenue",
        date: snap.deliveredAt || snap.orderDate,
        paymentMethod: "cash_on_delivery",
        referenceType: "order",
        referenceId: snap.order,
        referenceNumber: snap.orderNumber,
        description: `Auto-imported from delivered order. Revenue: ৳${snap.totalRevenue}, Profit: ৳${snap.grossProfit}`,
        status: "approved",
      };

      if (existing && overwrite) {
        await Transaction.findByIdAndUpdate(existing._id, transactionData);
      } else {
        await Transaction.create(transactionData);
      }
      created++;
    }

    console.log(
      `✅ [FINANCE] Imported ${created} order income transactions (skipped: ${skipped})`,
    );
    res.json({
      success: true,
      message: `Imported ${created} transactions, skipped ${skipped} already-existing`,
      created,
      skipped,
    });
  } catch (error) {
    console.error("❌ [FINANCE] Import orders error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

// @desc    Get all categories (dynamic from DB + defaults)
// @route   GET /api/finance/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const { type } = req.query;
    const matchType = type
      ? { type }
      : { type: { $in: ["income", "expense"] } };

    const dbCategories = await Transaction.aggregate([
      { $match: matchType },
      {
        $group: {
          _id: { type: "$type", category: "$category" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const result = {
      expense: [...new Set([...DEFAULT_EXPENSE_CATEGORIES])],
      income: [...new Set([...DEFAULT_INCOME_CATEGORIES])],
    };

    dbCategories.forEach((c) => {
      if (
        c._id.type === "expense" &&
        !result.expense.includes(c._id.category)
      ) {
        result.expense.push(c._id.category);
      }
      if (c._id.type === "income" && !result.income.includes(c._id.category)) {
        result.income.push(c._id.category);
      }
    });

    res.json({ success: true, data: type ? result[type] : result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────

// @desc    Export transactions as CSV
// @route   GET /api/finance/export?period=month&type=expense
// @access  Private
const exportTransactions = async (req, res) => {
  try {
    const { period, type, startDate, endDate } = req.query;
    const query = { status: "approved" };
    if (type) query.type = type;

    if (period && period !== "all") {
      const bounds = getPeriodBounds(period);
      if (bounds) query.date = { $gte: bounds.start, $lte: bounds.end };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .lean();

    // Build CSV
    const headers = [
      "Date",
      "Type",
      "Title",
      "Category",
      "Subcategory",
      "Amount (BDT)",
      "Payment Method",
      "Reference",
      "Party",
      "Status",
      "Tags",
      "Description",
    ];
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString("en-BD"),
      t.type,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      t.category,
      t.subcategory || "",
      t.amount,
      t.paymentMethod,
      t.referenceNumber || "",
      t.party?.name || "",
      t.status,
      (t.tags || []).join(";"),
      `"${(t.description || "").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions-${period || "all"}-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── OVERALL BALANCE ──────────────────────────────────────────────────────────

// @desc    Get account-level balance breakdown
// @route   GET /api/finance/balance
// @access  Private
const getBalance = async (req, res) => {
  try {
    const [byAccount, byMethod, overall] = await Promise.all([
      Transaction.aggregate([
        { $match: { status: "approved" } },
        {
          $group: {
            _id: { account: "$account", type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { status: "approved" } },
        {
          $group: {
            _id: { method: "$paymentMethod", type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: { status: "approved", type: { $in: ["income", "expense"] } },
        },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const inc = overall.find((o) => o._id === "income")?.total || 0;
    const exp = overall.find((o) => o._id === "expense")?.total || 0;

    // Build account map
    const accountMap = {};
    byAccount.forEach(({ _id, total }) => {
      const acc = _id.account || "Unspecified";
      if (!accountMap[acc]) accountMap[acc] = { income: 0, expense: 0 };
      accountMap[acc][_id.type] = total;
    });

    const accounts = Object.entries(accountMap).map(([name, vals]) => ({
      account: name,
      income: vals.income || 0,
      expense: vals.expense || 0,
      balance: (vals.income || 0) - (vals.expense || 0),
    }));

    // Payment method map
    const methodMap = {};
    byMethod.forEach(({ _id, total }) => {
      const m = _id.method || "other";
      if (!methodMap[m]) methodMap[m] = { income: 0, expense: 0 };
      methodMap[m][_id.type] = total;
    });

    const methods = Object.entries(methodMap).map(([method, vals]) => ({
      method,
      income: vals.income || 0,
      expense: vals.expense || 0,
      net: (vals.income || 0) - (vals.expense || 0),
    }));

    res.json({
      success: true,
      data: {
        totalIncome: inc,
        totalExpense: exp,
        netBalance: inc - exp,
        accounts,
        paymentMethods: methods,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // Transactions
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  voidTransaction,
  bulkCreateTransactions,
  // Summary & Analytics
  getFinanceSummary,
  getPnLStatement,
  getCategoryAnalytics,
  getCashFlowProjection,
  // Budgets
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
  // Import
  importOrderIncome,
  // Utility
  getCategories,
  exportTransactions,
  getBalance,
};
