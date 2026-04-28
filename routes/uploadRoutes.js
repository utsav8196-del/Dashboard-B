const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  "/",
  protect,
  adminOnly,
  upload.single("image"),
  asyncHandler((req, res) => {
    if (!req.file) {
      const error = new Error("Image upload failed");
      error.statusCode = 400;
      throw error;
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.status(201).json({ imageUrl });
  })
);

module.exports = router;
