const express = require("express");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    createBill,
    getAllBills,
    getBillById,
    updateBill,
    updatePaymentStatus,
    deleteBill,
    getBillStats,
} = require("../controllers/billController");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All bill routes require admin authentication
router.use(protect, adminOnly);

// Get bill statistics
router.get("/stats", asyncHandler(getBillStats));

// Get all bills
router.get("/", asyncHandler(getAllBills));

// Get single bill
router.get("/:id", asyncHandler(getBillById));

// Create new bill
router.post("/", asyncHandler(createBill));

// Update bill
router.put("/:id", asyncHandler(updateBill));

// Update payment status
router.patch("/:id/payment-status", asyncHandler(updatePaymentStatus));

// Delete bill
router.delete("/:id", asyncHandler(deleteBill));

module.exports = router;
