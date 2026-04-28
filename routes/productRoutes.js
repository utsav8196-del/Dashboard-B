const express = require("express");
const { body } = require("express-validator");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { handleValidation } = require("../middleware/validationMiddleware");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const productValidation = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be positive"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be 0 or more"),
  handleValidation,
];

router.get("/", asyncHandler(getProducts));
router.get("/:id", asyncHandler(getProductById));
router.post("/", protect, adminOnly, productValidation, asyncHandler(createProduct));
router.put("/:id", protect, adminOnly, productValidation, asyncHandler(updateProduct));
router.delete("/:id", protect, adminOnly, asyncHandler(deleteProduct));

module.exports = router;
