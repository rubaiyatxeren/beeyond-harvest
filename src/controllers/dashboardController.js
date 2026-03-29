const Product = require("../models/Product");
const Order = require("../models/Order");
const Category = require("../models/Category");
const Admin = require("../models/Admin");

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalCategories = await Category.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalAdmins = await Admin.countDocuments();

    const lowStockProducts = await Product.countDocuments({
      stock: { $lt: 10 },
    });
    const outOfStockProducts = await Product.countDocuments({ stock: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today },
    });

    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          orderStatus: "delivered",
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    // Recent orders
    const recentOrders = await Order.find().sort("-createdAt").limit(5);

    // Top selling products
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        totalCategories,
        totalOrders,
        totalAdmins,
        lowStockProducts,
        outOfStockProducts,
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        recentOrders,
        topProducts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sales analytics
// @route   GET /api/dashboard/sales
// @access  Private
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "monthly", year = new Date().getFullYear() } = req.query;

    let groupBy;
    let dateFormat;

    if (period === "daily") {
      groupBy = { $dayOfMonth: "$createdAt" };
      dateFormat = "%d";
    } else if (period === "monthly") {
      groupBy = { $month: "$createdAt" };
      dateFormat = "%m";
    } else {
      groupBy = { $year: "$createdAt" };
      dateFormat = "%Y";
    }

    const sales = await Order.aggregate([
      {
        $match: {
          orderStatus: "delivered",
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: groupBy,
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getSalesAnalytics,
};
