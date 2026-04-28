const express = require("express");
const { body } = require("express-validator");
const { createOrder, getOrders, updateOrderStatus } = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { handleValidation } = require("../middleware/validationMiddleware");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  "/",
  protect,
  [
    body("products").isArray({ min: 1 }).withMessage("Products are required"),
    body("shippingAddress.fullName").notEmpty().withMessage("Full name is required"),
    body("shippingAddress.address").notEmpty().withMessage("Address is required"),
    body("shippingAddress.city").notEmpty().withMessage("City is required"),
    body("shippingAddress.country").notEmpty().withMessage("Country is required"),
    handleValidation,
  ],
  asyncHandler(createOrder),
);

router.get("/", protect, asyncHandler(getOrders));
router.put(
  "/:id",
  protect,
  adminOnly,
  [
    body("status")
      .isIn(["Pending", "Shipped", "Delivered"])
      .withMessage("Valid order status is required"),
    handleValidation,
  ],
  asyncHandler(updateOrderStatus),
);

module.exports = router;
