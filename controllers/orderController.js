const Order = require("../models/Order");
const Product = require("../models/Product");

// ✅ Development storage for orders when database is down
const devOrders = [];

async function createOrder(req, res) {
  try {
    const { products, shippingAddress, paymentMethod } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      const error = new Error("At least one product is required");
      error.statusCode = 400;
      throw error;
    }

    const productIds = products.map((item) => item.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(dbProducts.map((product) => [String(product._id), product]));

    let totalAmount = 0;
    const lineItems = [];

    for (const item of products) {
      if (!item.quantity || item.quantity < 1) {
        const error = new Error("Product quantities must be at least 1");
        error.statusCode = 400;
        throw error;
      }

      const product = productMap.get(String(item.productId));

      if (!product) {
        const error = new Error("One or more products could not be found");
        error.statusCode = 404;
        throw error;
      }

      if (product.stock < item.quantity) {
        const error = new Error(`Insufficient stock for ${product.title}`);
        error.statusCode = 400;
        throw error;
      }

      totalAmount += product.price * item.quantity;
      lineItems.push({
        product: product._id,
        title: product.title,
        image: product.image,
        category: product.category,
        price: product.price,
        quantity: item.quantity,
      });
    }

    await Promise.all(
      lineItems.map((item) =>
        Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity, sold: item.quantity },
        }),
      ),
    );

    const order = await Order.create({
      userId: req.user._id,
      products: lineItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
    });

    const populatedOrder = await Order.findById(order._id).populate("userId", "name email");
    const payload = {
      _id: populatedOrder._id,
      userId: String(req.user._id),
      customer: req.user.name,
      totalAmount: populatedOrder.totalAmount,
      status: populatedOrder.status,
      createdAt: populatedOrder.createdAt,
    };

    req.app.locals.socketState.notifyNewOrder(payload);
    req.app.locals.socketState.broadcastDashboardRefresh({ type: "orders" });

    res.status(201).json(populatedOrder);
  } catch (dbError) {
    // ✅ Development mode: Store order in memory
    console.warn("⚠️  Database save failed, storing order in development storage");

    const { products, shippingAddress, paymentMethod } = req.body;

    let totalAmount = 0;
    const lineItems = products.map((item) => ({
      productId: item.productId,
      title: item.title || "Product",
      price: item.price || 0,
      quantity: item.quantity || 1,
    }));

    lineItems.forEach((item) => {
      totalAmount += item.price * item.quantity;
    });

    const newOrder = {
      _id: `dev-order-${Date.now()}`,
      userId: req.user._id,
      customer: req.user.name || "Customer",
      products: lineItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devOrders.push(newOrder);

    try {
      req.app.locals.socketState.notifyNewOrder({
        _id: newOrder._id,
        userId: String(req.user._id),
        customer: newOrder.customer,
        totalAmount: newOrder.totalAmount,
        status: newOrder.status,
        createdAt: newOrder.createdAt,
      });
      req.app.locals.socketState.broadcastDashboardRefresh({ type: "orders" });
    } catch (e) {
      // Socket might not be ready
    }

    res.status(201).json(newOrder);
  }
}

async function getOrders(req, res) {
  try {
    const query = req.user.role === "admin" ? {} : { userId: req.user._id };
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (dbError) {
    // ✅ Development mode: Return dev orders
    console.warn("⚠️  Database lookup failed, returning development orders");

    let filteredOrders = devOrders;

    if (req.user.role !== "admin") {
      filteredOrders = devOrders.filter((order) => order.userId === req.user._id);
    }

    res.json(filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate("userId", "name email");

    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    order.status = status;
    await order.save();

    req.app.locals.socketState.notifyOrderUpdate({
      _id: order._id,
      userId: String(order.userId._id),
      customer: order.userId.name,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
    });
    req.app.locals.socketState.broadcastDashboardRefresh({ type: "orders" });

    res.json(order);
  } catch (dbError) {
    // ✅ Development mode: Update in dev storage
    console.warn("⚠️  Database update failed, updating development storage");

    const devOrder = devOrders.find((o) => o._id === req.params.id);

    if (!devOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    devOrder.status = req.body.status;
    devOrder.updatedAt = new Date();

    try {
      req.app.locals.socketState.notifyOrderUpdate({
        _id: devOrder._id,
        userId: String(devOrder.userId),
        customer: devOrder.customer,
        totalAmount: devOrder.totalAmount,
        status: devOrder.status,
        createdAt: devOrder.createdAt,
      });
      req.app.locals.socketState.broadcastDashboardRefresh({ type: "orders" });
    } catch (e) {
      // Socket might not be ready
    }

    res.json(devOrder);
  }
}

module.exports = { createOrder, getOrders, updateOrderStatus };
