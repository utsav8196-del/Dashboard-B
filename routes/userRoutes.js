const express = require("express");
const { body } = require("express-validator");
const { getUsers, updateUserStatus } = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { handleValidation } = require("../middleware/validationMiddleware");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/", protect, adminOnly, asyncHandler(getUsers));
router.put(
  "/:id/status",
  protect,
  adminOnly,
  [
    body("isActive")
      .custom((value) => typeof value === "boolean")
      .withMessage("isActive must be true or false"),
    handleValidation,
  ],
  asyncHandler(updateUserStatus),
);

module.exports = router;
