const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

function buildDateWindow(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function buildMonthWindow(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

async function getDashboardSummary(req, res) {
  const [userCount, orderCount, revenueResult, topProducts, categoryPerformance, recentOrders, dailySales, monthlySales] =
    await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
      Product.find()
        .sort({ sold: -1, createdAt: -1 })
        .limit(5)
        .select("title category sold stock price image"),
      Order.aggregate([
        { $unwind: "$products" },
        {
          $group: {
            _id: "$products.category",
            quantity: { $sum: "$products.quantity" },
            revenue: {
              $sum: { $multiply: ["$products.price", "$products.quantity"] },
            },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      Order.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(6),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: buildDateWindow(6) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%d %b", date: "$createdAt" },
            },
            sales: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: buildMonthWindow(5) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%b %Y", date: "$createdAt" },
            },
            sales: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  res.json({
    overview: {
      totalUsers: userCount,
      totalOrders: orderCount,
      totalRevenue: revenueResult[0]?.totalRevenue || 0,
      activeUsers: req.app.locals.socketState.getActiveUsersCount(),
    },
    dailySales,
    monthlySales,
    topProducts,
    categoryPerformance,
    recentOrders,
  });
}

module.exports = { getDashboardSummary };
