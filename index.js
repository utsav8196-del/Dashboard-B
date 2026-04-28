const dotenv = require("dotenv");
dotenv.config(); // ✅ Load environment variables FIRST

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { createSocketServer } = require("./config/socket");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const billRoutes = require("./routes/billRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB();

  const app = express();
  const server = http.createServer(app);
  const { io, socketState } = createSocketServer(server);

  app.locals.io = io;
  app.locals.socketState = socketState;

  app.use(
    cors({
      origin: (process.env.CLIENT_URL || "http://localhost:5173")
        .split(",")
        .map((entry) => entry.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/bills", billRoutes);

  app.use(notFound);
  app.use(errorHandler);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("⚠️  Error during server startup:", error.message);
  console.error("Server starting with limited functionality...");
});
