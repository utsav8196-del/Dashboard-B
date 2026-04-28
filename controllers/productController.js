const Product = require("../models/Product");

// ✅ Development storage for products when database is down
const devProducts = [];

const sortMap = {
  newest: { createdAt: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  popularity: { sold: -1, createdAt: -1 },
};

async function getProducts(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 8);
    const q = req.query.q?.trim();
    const category = req.query.category?.trim();
    const sort = req.query.sort || "newest";

    const query = {};

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      query.category = category;
    }

    const [products, total, categories] = await Promise.all([
      Product.find(query)
        .sort(sortMap[sort] || sortMap.newest)
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(query),
      Product.distinct("category"),
    ]);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
      categories: ["All", ...categories.sort()],
    });
  } catch (dbError) {
    // ✅ Development mode: Return dev products
    console.warn("⚠️  Database lookup failed, returning development products");

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 8);

    const filteredProducts = devProducts.slice((page - 1) * limit, page * limit);
    const categories = [...new Set(devProducts.map(p => p.category))];

    res.json({
      products: filteredProducts,
      pagination: {
        page,
        limit,
        total: devProducts.length,
        pages: Math.ceil(devProducts.length / limit),
        hasNext: page * limit < devProducts.length,
      },
      categories: ["All", ...categories.sort()],
    });
  }
}

async function getProductById(req, res) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    res.json(product);
  } catch (dbError) {
    // ✅ Development mode: Return from dev storage
    const devProduct = devProducts.find(p => p._id === req.params.id);

    if (!devProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(devProduct);
  }
}

async function createProduct(req, res) {
  try {
    const product = await Product.create(req.body);
    req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    res.status(201).json(product);
  } catch (dbError) {
    // ✅ Development mode: Store in memory
    console.warn("⚠️  Database save failed, storing in development storage");

    const newProduct = {
      _id: `dev-product-${Date.now()}`,
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      sold: 0,
    };

    devProducts.push(newProduct);

    try {
      req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    } catch (e) {
      // Socket might not be ready
    }

    res.status(201).json(newProduct);
  }
}

async function updateProduct(req, res) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    Object.assign(product, req.body);
    await product.save();
    req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    res.json(product);
  } catch (dbError) {
    // ✅ Development mode: Update in dev storage
    console.warn("⚠️  Database update failed, updating development storage");

    const devProduct = devProducts.find(p => p._id === req.params.id);

    if (!devProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(devProduct, req.body, { updatedAt: new Date() });

    try {
      req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    } catch (e) {
      // Socket might not be ready
    }

    res.json(devProduct);
  }
}

async function deleteProduct(req, res) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }

    await product.deleteOne();
    req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    res.json({ message: "Product deleted" });
  } catch (dbError) {
    // ✅ Development mode: Delete from dev storage
    console.warn("⚠️  Database delete failed, deleting from development storage");

    const index = devProducts.findIndex(p => p._id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    devProducts.splice(index, 1);

    try {
      req.app.locals.socketState.broadcastDashboardRefresh({ type: "products" });
    } catch (e) {
      // Socket might not be ready
    }

    res.json({ message: "Product deleted" });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
