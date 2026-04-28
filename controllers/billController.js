const Bill = require("../models/Bill");
const Product = require("../models/Product");
const {
    sendBillCreatedEmail,
    sendPaymentConfirmedEmail,
} = require("../utils/emailService");
const {
    schedulePaymentReminder,
    cancelPaymentReminder,
} = require("../utils/jobScheduler");

// ✅ CREATE BILL (WITH AUTO INVENTORY UPDATE & EMAIL)
async function createBill(req, res) {
    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            items,
            tax,
            discount,
            paymentMethod,
            paymentStatus,
            notes,
        } = req.body;

        console.log("REQ BODY:", req.body);

        if (!customerName || !items || items.length === 0) {
            return res.status(400).json({
                message: "Customer name and items are required",
            });
        }

        if (!customerEmail) {
            return res.status(400).json({
                message: "Customer email is required for email notifications",
            });
        }

        let subtotal = 0;
        const billItems = [];

        // ✅ STEP 1: VALIDATE STOCK & CALCULATE TOTALS
        for (const item of items) {
            const product = await Product.findById(item.productId);

            if (!product) {
                return res.status(404).json({
                    message: `Product not found: ${item.productId}`,
                });
            }

            // Check if sufficient stock available
            if (paymentStatus === "paid" && product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.title}. Available: ${product.stock}, Requested: ${item.quantity}`,
                });
            }

            const itemTotal = item.quantity * item.price;
            subtotal += itemTotal;

            billItems.push({
                productId: product._id,
                productName: product.title,
                quantity: item.quantity,
                price: item.price,
                total: itemTotal,
            });
        }

        const taxAmount = tax || 0;
        const discountAmount = discount || 0;
        const total = subtotal + taxAmount - discountAmount;

        const bill = new Bill({
            customerName,
            customerEmail,
            customerPhone,
            items: billItems,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            total,
            paymentMethod: paymentMethod || "cash",
            notes,
            createdBy: req.user?._id,
            status: "finalized",
            paymentStatus: paymentStatus || "pending",
        });

        await bill.save();

        // ✅ STEP 2: IF PAYMENT IS COMPLETE, UPDATE PRODUCT INVENTORY
        if (paymentStatus === "paid") {
            for (const item of items) {
                const updatedProduct = await Product.findByIdAndUpdate(
                    item.productId,
                    {
                        $inc: {
                            stock: -item.quantity, // Decrease stock
                            sold: item.quantity,   // Increase sold count
                        },
                    },
                    { new: true }
                );
                console.log(`✅ Product decreased - ${updatedProduct.title}: Stock: ${updatedProduct.stock}, Sold: ${updatedProduct.sold}`);
            }

            console.log("✅ Product inventory updated successfully");

            // Send payment confirmed email
            await sendPaymentConfirmedEmail(bill);
        } else {
            // Send bill created email (for pending bills)
            await sendBillCreatedEmail(bill);

            // Schedule payment reminder email for 1 hour later
            schedulePaymentReminder(bill);
        }

        res.status(201).json({
            message: "Bill created successfully",
            bill,
        });
    } catch (error) {
        console.error("CREATE BILL ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ GET ALL BILLS
async function getAllBills(req, res) {
    try {
        const { page = 1, limit = 10, status, paymentStatus } = req.query;

        const query = {};
        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        const bills = await Bill.find(query)
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Bill.countDocuments(query);

        res.json({
            bills,
            totalBills: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        console.error("GET BILLS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ GET SINGLE BILL
async function getBillById(req, res) {
    try {
        const bill = await Bill.findById(req.params.id).populate(
            "createdBy",
            "name email"
        );

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        res.json(bill);
    } catch (error) {
        console.error("GET BILL ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ UPDATE BILL
async function updateBill(req, res) {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const {
            customerName,
            customerEmail,
            customerPhone,
            items,
            tax,
            discount,
            paymentMethod,
            notes,
            paymentStatus,
        } = req.body;

        if (customerName) bill.customerName = customerName;
        if (customerEmail) bill.customerEmail = customerEmail;
        if (customerPhone) bill.customerPhone = customerPhone;
        if (paymentMethod) bill.paymentMethod = paymentMethod;
        if (notes) bill.notes = notes;
        if (paymentStatus) bill.paymentStatus = paymentStatus;

        if (items && items.length > 0) {
            let subtotal = 0;
            const billItems = [];

            for (const item of items) {
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({
                        message: `Product not found: ${item.productId}`,
                    });
                }

                const itemTotal = item.quantity * item.price;
                subtotal += itemTotal;

                billItems.push({
                    productId: product._id,
                    productName: product.title,
                    quantity: item.quantity,
                    price: item.price,
                    total: itemTotal,
                });
            }

            bill.items = billItems;
            bill.subtotal = subtotal;
            bill.total = subtotal + (tax || 0) - (discount || 0);
        }

        if (tax !== undefined) bill.tax = tax;
        if (discount !== undefined) bill.discount = discount;

        await bill.save();
        res.json({ message: "Bill updated successfully", bill });
    } catch (error) {
        console.error("UPDATE BILL ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ UPDATE PAYMENT STATUS (WITH INVENTORY UPDATE & EMAIL)
async function updatePaymentStatus(req, res) {
    try {
        const { paymentStatus } = req.body;

        if (!["paid", "pending", "cancelled"].includes(paymentStatus)) {
            return res.status(400).json({ message: "Invalid payment status" });
        }

        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const previousStatus = bill.paymentStatus;

        // ✅ IF CHANGING FROM PENDING TO PAID, UPDATE INVENTORY
        if (previousStatus === "pending" && paymentStatus === "paid") {
            // Check if all products have sufficient stock
            for (const item of bill.items) {
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({
                        message: `Product not found: ${item.productId}`,
                    });
                }

                if (product.stock < item.quantity) {
                    return res.status(400).json({
                        message: `Insufficient stock for ${product.productName}. Available: ${product.stock}, Required: ${item.quantity}`,
                    });
                }
            }

            // Update inventory for all products
            for (const item of bill.items) {
                const updatedProduct = await Product.findByIdAndUpdate(
                    item.productId,
                    {
                        $inc: {
                            stock: -item.quantity, // Decrease stock
                            sold: item.quantity,   // Increase sold count
                        },
                    },
                    { new: true }
                );
                console.log(`✅ Product decreased - ${updatedProduct.title}: Stock: ${updatedProduct.stock}, Sold: ${updatedProduct.sold}`);
            }

            console.log("✅ Product inventory updated - Payment marked as PAID");

            // Cancel scheduled reminder email
            cancelPaymentReminder(bill._id);

            // Send payment confirmed email
            await sendPaymentConfirmedEmail(bill);
        }

        // ✅ IF CHANGING FROM PAID TO PENDING/CANCELLED, RESTORE INVENTORY
        if (previousStatus === "paid" && (paymentStatus === "pending" || paymentStatus === "cancelled")) {
            for (const item of bill.items) {
                const updatedProduct = await Product.findByIdAndUpdate(
                    item.productId,
                    {
                        $inc: {
                            stock: item.quantity,  // Restore stock
                            sold: -item.quantity,  // Decrease sold count
                        },
                    },
                    { new: true }
                );
                console.log(`✅ Product restored - ${updatedProduct.title}: Stock: ${updatedProduct.stock}, Sold: ${updatedProduct.sold}`);
            }

            console.log("✅ Product inventory restored - Payment status changed to " + paymentStatus);

            // If changing to pending, schedule new reminder
            if (paymentStatus === "pending") {
                schedulePaymentReminder(bill);
            }
        }

        bill.paymentStatus = paymentStatus;
        await bill.save();

        res.json({ message: "Payment status updated successfully", bill });
    } catch (error) {
        console.error("UPDATE PAYMENT STATUS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ DELETE BILL (WITH INVENTORY RESTORATION & SCHEDULED JOB CANCELLATION)
async function deleteBill(req, res) {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        // ✅ CANCEL ANY SCHEDULED REMINDERS
        cancelPaymentReminder(bill._id);

        // ✅ IF BILL WAS PAID, RESTORE INVENTORY
        if (bill.paymentStatus === "paid") {
            for (const item of bill.items) {
                const updatedProduct = await Product.findByIdAndUpdate(
                    item.productId,
                    {
                        $inc: {
                            stock: item.quantity,  // Restore stock
                            sold: -item.quantity,  // Decrease sold count
                        },
                    },
                    { new: true }
                );
                console.log(`✅ Product restored - ${updatedProduct.title}: Stock: ${updatedProduct.stock}, Sold: ${updatedProduct.sold}`);
            }

            console.log("✅ Product inventory restored - Bill deleted");
        }

        await bill.deleteOne();

        res.json({ message: "Bill deleted successfully and inventory restored" });
    } catch (error) {
        console.error("DELETE BILL ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

// ✅ GET BILL STATISTICS
async function getBillStats(req, res) {
    try {
        const totalBills = await Bill.countDocuments();
        const paidBills = await Bill.countDocuments({ paymentStatus: "paid" });
        const pendingBills = await Bill.countDocuments({ paymentStatus: "pending" });

        const billsData = await Bill.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalTax: { $sum: "$tax" },
                    totalDiscount: { $sum: "$discount" },
                },
            },
        ]);

        const stats = billsData[0] || {
            totalRevenue: 0,
            totalTax: 0,
            totalDiscount: 0,
        };

        res.json({
            totalBills,
            paidBills,
            pendingBills,
            ...stats,
        });
    } catch (error) {
        console.error("GET BILL STATS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    createBill,
    getAllBills,
    getBillById,
    updateBill,
    updatePaymentStatus,
    deleteBill,
    getBillStats,
};

