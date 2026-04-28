function generateToken(user) {
  const jwt = require("jsonwebtoken");

  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
}

module.exports = generateToken;
