const express = require("express");
const { getDashboardSummary } = require("../controllers/dashboardController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/summary", protect, adminOnly, asyncHandler(getDashboardSummary));

module.exports = router;
