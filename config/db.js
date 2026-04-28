// const mongoose = require("mongoose");

// async function connectDB() {
//   const mongoUri = process.env.MONGO_URI;

//   if (!mongoUri) {
//     throw new Error("MONGO_URI is not configured");
//   }

//   const connection = await mongoose.connect(mongoUri);
//   console.log(`MongoDB connected: ${connection.connection.host}`);
// }

// module.exports = connectDB;



const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn("⚠️  MONGO_URI is not configured");
    console.warn("📊 Database features will be disabled");
    return;
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error("⚠️  MongoDB connection error:", error.message);
    console.error("📊 Database features will be disabled. Server continuing without database.");
  }
}

module.exports = connectDB;