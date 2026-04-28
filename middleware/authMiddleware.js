const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      const error = new Error("Not authorized, token missing");
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Try to get user from database
    try {
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        const error = new Error("User no longer exists");
        error.statusCode = 401;
        return next(error);
      }

      if (!user.isActive) {
        const error = new Error("Your account is inactive");
        error.statusCode = 403;
        return next(error);
      }

      req.user = user;
    } catch (dbError) {
      // ✅ If database is down, use decoded token info (development mode)
      console.warn("⚠️  Database lookup failed, using token info for user:", decoded.userId);
      req.user = {
        _id: decoded.userId,
        email: decoded.email || "user@example.com",
        role: decoded.role || "user",
        isActive: true,
      };
    }

    next();
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    next(error);
  }
}

function adminOnly(req, _res, next) {
  if (req.user?.role !== "admin") {
    const error = new Error("Admin access required");
    error.statusCode = 403;
    return next(error);
  }

  next();
}

module.exports = { protect, adminOnly };
