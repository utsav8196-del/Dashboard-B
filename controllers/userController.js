const User = require("../models/User");

async function getUsers(_req, res) {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  res.json(users);
}

async function updateUserStatus(req, res) {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  user.isActive = req.body.isActive;
  await user.save();

  req.app.locals.socketState.broadcastDashboardRefresh({ type: "users" });
  res.json(user);
}

module.exports = { getUsers, updateUserStatus };
