const dotenv = require("dotenv");
const connectDB = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

dotenv.config();

const productSeeds = [
  {
    title: "AeroPulse Headphones",
    description: "Wireless over-ear headphones with rich bass, long battery life, and low-latency mode.",
    price: 189,
    category: "Audio",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    stock: 36,
    sold: 24,
  },
  {
    title: "Vertex Smartwatch",
    description: "Fitness-forward smartwatch with AMOLED display, GPS, and seven-day battery life.",
    price: 249,
    category: "Wearables",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    stock: 21,
    sold: 15,
  },
  {
    title: "Northstar Backpack",
    description: "Weather-resistant everyday backpack with modular pockets and laptop sleeve.",
    price: 96,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    stock: 58,
    sold: 42,
  },
  {
    title: "Studio Lamp Pro",
    description: "Minimal desk lamp with adjustable warmth, wireless charging, and memory presets.",
    price: 124,
    category: "Home",
    image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80",
    stock: 19,
    sold: 11,
  },
  {
    title: "Summit Trail Shoes",
    description: "Responsive trail runners with grippy soles, breathable mesh, and impact support.",
    price: 142,
    category: "Footwear",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    stock: 44,
    sold: 30,
  },
  {
    title: "Canvas Camera Sling",
    description: "Compact sling bag with quick-access compartments for cameras and daily essentials.",
    price: 88,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80",
    stock: 26,
    sold: 12,
  },
];

async function seed() {
  await connectDB();

  await Promise.all([User.deleteMany(), Product.deleteMany(), Order.deleteMany()]);

  const admin = await User.create({
    name: "PulseCart Admin",
    email: process.env.ADMIN_EMAIL || "admin@pulsecart.dev",
    password: process.env.ADMIN_PASSWORD || "admin123456",
    role: "admin",
  });

  const customers = await User.create([
    {
      name: "Olivia Carter",
      email: "olivia@example.com",
      password: "demo1234",
      role: "user",
      isActive: true,
    },
    {
      name: "Marcus Reed",
      email: "marcus@example.com",
      password: "demo1234",
      role: "user",
      isActive: true,
    },
  ]);

  const products = await Product.insertMany(productSeeds);

  await Order.insertMany([
    {
      userId: customers[0]._id,
      products: [
        {
          product: products[0]._id,
          title: products[0].title,
          image: products[0].image,
          category: products[0].category,
          price: products[0].price,
          quantity: 1,
        },
        {
          product: products[2]._id,
          title: products[2].title,
          image: products[2].image,
          category: products[2].category,
          price: products[2].price,
          quantity: 2,
        },
      ],
      totalAmount: products[0].price + products[2].price * 2,
      status: "Delivered",
      shippingAddress: {
        fullName: customers[0].name,
        phone: "555-0100",
        address: "125 Market Street",
        city: "San Francisco",
        postalCode: "94103",
        country: "USA",
      },
    },
    {
      userId: customers[1]._id,
      products: [
        {
          product: products[1]._id,
          title: products[1].title,
          image: products[1].image,
          category: products[1].category,
          price: products[1].price,
          quantity: 1,
        },
      ],
      totalAmount: products[1].price,
      status: "Pending",
      shippingAddress: {
        fullName: customers[1].name,
        phone: "555-0102",
        address: "52 Madison Ave",
        city: "New York",
        postalCode: "10010",
        country: "USA",
      },
    },
  ]);

  console.log("Seed complete");
  console.log(`Admin login: ${admin.email} / ${process.env.ADMIN_PASSWORD || "admin123456"}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
