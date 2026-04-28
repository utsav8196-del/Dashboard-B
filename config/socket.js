const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

function extractToken(socket) {
  const headerToken = socket.handshake.headers.authorization?.startsWith("Bearer ")
    ? socket.handshake.headers.authorization.split(" ")[1]
    : null;

  return socket.handshake.auth?.token || headerToken || null;
}

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: (process.env.CLIENT_URL || "http://localhost:5173")
        .split(",")
        .map((entry) => entry.trim()),
      credentials: true,
    },
  });

  const socketCounts = new Map();

  function incrementUser(userId) {
    socketCounts.set(userId, (socketCounts.get(userId) || 0) + 1);
  }

  function decrementUser(userId) {
    const nextCount = (socketCounts.get(userId) || 1) - 1;

    if (nextCount <= 0) {
      socketCounts.delete(userId);
      return;
    }

    socketCounts.set(userId, nextCount);
  }

  function emitPresence() {
    io.to("admins").emit("dashboard:presence", {
      activeUsers: socketCounts.size,
    });
  }

  io.use((socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: decoded.userId,
        name: decoded.name,
        role: decoded.role,
      };
    } catch (_error) {
      socket.user = null;
    }

    return next();
  });

  io.on("connection", (socket) => {
    if (socket.user?.id) {
      incrementUser(socket.user.id);
      socket.join(`user:${socket.user.id}`);

      if (socket.user.role === "admin") {
        socket.join("admins");
      }

      emitPresence();
    }

    socket.on("admin:join", () => {
      if (socket.user?.role === "admin") {
        socket.join("admins");
        emitPresence();
      }
    });

    socket.on("disconnect", () => {
      if (socket.user?.id) {
        decrementUser(socket.user.id);
        emitPresence();
      }
    });
  });

  return {
    io,
    socketState: {
      getActiveUsersCount: () => socketCounts.size,
      emitPresence,
      broadcastDashboardRefresh: (payload = {}) => {
        io.to("admins").emit("dashboard:refresh", payload);
      },
      notifyNewOrder: (payload) => {
        io.to("admins").emit("order:new", payload);
      },
      notifyOrderUpdate: (payload) => {
        io.to("admins").emit("order:updated", payload);
        io.to(`user:${payload.userId}`).emit("order:updated", payload);
      },
    },
  };
}

module.exports = { createSocketServer };
