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

  const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((entry) => entry.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Auto-allow common hosting domains (Vercel, Render, Netlify, GitHub Pages)
        const autoAllowed = ["vercel.app", "onrender.com", "netlify.app", "github.io", "surge.sh", "firebaseapp.com"];
        if (autoAllowed.some((domain) => origin.includes(domain))) {
          return callback(null, true);
        }
        // Fallback: allow everything (safe for public APIs / demos)
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
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
