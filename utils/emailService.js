const nodemailer = require("nodemailer");

// ✅ CHECK EMAIL CREDENTIALS
const hasEmailCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

let transporter = null;

if (hasEmailCredentials) {
    // ✅ CONFIGURE NODEMAILER (GMAIL) - FIXED SSL/TLS CERTIFICATE ERROR
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER.trim(),
            pass: process.env.EMAIL_PASSWORD.trim().replace(/\s+/g, ""), // ✅ Remove all spaces
        },
        tls: {
            rejectUnauthorized: false, // ✅ FIXES: self-signed certificate error
        },
    });

    // ✅ VERIFY TRANSPORTER CONNECTION (Non-blocking)
    transporter.verify((error, success) => {
        if (error) {
            console.warn("⚠️  SMTP Email Configuration Error:", error.message);
            console.warn("📧 Email features will be disabled. Check EMAIL_USER and EMAIL_PASSWORD in .env");
        } else {
            console.log("✅ SMTP Server ready for sending emails");
        }
    });
} else {
    console.warn("⚠️  WARNING: EMAIL_USER or EMAIL_PASSWORD not set in .env file");
    console.warn("📧 Email features will be disabled. Set credentials to enable bill emails.");
}

// ✅ SEND EMAIL - BILL CREATED (Pending Payment)
async function sendBillCreatedEmail(bill) {
    try {
        const itemsHTML = bill.items
            .map(
                (item) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.productName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.price}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.total}</td>
            </tr>
        `
            )
            .join("");

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: bill.customerEmail,
            subject: `📦 Your Bill #${bill.billNumber} - Payment Pending`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">🛒 Bill Created Successfully</h2>
                    </div>
                    
                    <div style="padding: 20px; background: #f9f9f9;">
                        <p>Hi <strong>${bill.customerName}</strong>,</p>
                        
                        <p>Thank you for your order! Your bill has been created and is waiting for payment.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Bill Details:</strong></p>
                            <p>Bill Number: <strong>#${bill.billNumber}</strong></p>
                            <p>Date: <strong>${new Date(bill.createdAt).toLocaleString()}</strong></p>
                            <p>Customer: <strong>${bill.customerName}</strong></p>
                            <p>Phone: <strong>${bill.customerPhone}</strong></p>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f0f0f0;">
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Product</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Qty</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Price</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                        </table>
                        
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Subtotal:</strong> ₹${bill.subtotal}</p>
                            <p><strong>Tax:</strong> ₹${bill.tax}</p>
                            <p><strong>Discount:</strong> ₹${bill.discount}</p>
                            <h3 style="color: #667eea; margin: 10px 0 0 0;">Total Amount: ₹${bill.total}</h3>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            ⏰ <strong>Action Required:</strong> Please make the payment to complete your order.
                        </p>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">
                                If you have any questions, please reply to this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
                        <p>© 2024 PulseCart. All rights reserved.</p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Bill created email sent to ${bill.customerEmail}`);
    } catch (error) {
        console.error("❌ Error sending bill created email:", error.message);
        console.error("📧 Email Config - Host:", process.env.EMAIL_HOST, "User:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
    }
}

// ✅ SEND EMAIL - PAYMENT RECEIVED (Order Confirmed)
async function sendPaymentConfirmedEmail(bill) {
    try {
        const itemsHTML = bill.items
            .map(
                (item) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.productName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.price}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.total}</td>
            </tr>
        `
            )
            .join("");

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: bill.customerEmail,
            subject: `✅ Payment Confirmed - Order #${bill.billNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">✅ Payment Received Successfully</h2>
                    </div>
                    
                    <div style="padding: 20px; background: #f9f9f9;">
                        <p>Hi <strong>${bill.customerName}</strong>,</p>
                        
                        <p>🎉 Your payment has been received and your order is confirmed!</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Order Details:</strong></p>
                            <p>Order Number: <strong>#${bill.billNumber}</strong></p>
                            <p>Order Date: <strong>${new Date(bill.createdAt).toLocaleString()}</strong></p>
                            <p>Payment Method: <strong>${bill.paymentMethod.toUpperCase()}</strong></p>
                            <p>Status: <strong style="color: #38ef7d;">✅ PAID</strong></p>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f0f0f0;">
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #11998e;">Product</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #11998e;">Qty</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #11998e;">Price</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #11998e;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                        </table>
                        
                        <div style="background: #e8f8f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #38ef7d;">
                            <p><strong>Subtotal:</strong> ₹${bill.subtotal}</p>
                            <p><strong>Tax:</strong> ₹${bill.tax}</p>
                            <p><strong>Discount:</strong> ₹${bill.discount}</p>
                            <h3 style="color: #38ef7d; margin: 10px 0 0 0;">Amount Paid: ₹${bill.total}</h3>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            📦 Your order has been processed and will be dispatched soon. You will receive a tracking number shortly.
                        </p>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">
                                Thank you for shopping with us! If you have any questions, please reply to this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
                        <p>© 2024 PulseCart. All rights reserved.</p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Payment confirmed email sent to ${bill.customerEmail}`);
    } catch (error) {
        console.error("❌ Error sending payment confirmed email:", error.message);
        console.error("📧 Email Config - Host:", process.env.EMAIL_HOST, "User:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
    }
}

// ✅ SEND EMAIL - PAYMENT REMINDER (1 Hour After Bill Created)
async function sendPaymentReminderEmail(bill) {
    try {
        const itemsHTML = bill.items
            .map(
                (item) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.productName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.total}</td>
            </tr>
        `
            )
            .join("");

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: bill.customerEmail,
            subject: `⏰ Payment Reminder - Bill #${bill.billNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">⏰ Payment Reminder</h2>
                    </div>
                    
                    <div style="padding: 20px; background: #f9f9f9;">
                        <p>Hi <strong>${bill.customerName}</strong>,</p>
                        
                        <p>This is a friendly reminder that your bill is still pending payment.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Bill Summary:</strong></p>
                            <p>Bill Number: <strong>#${bill.billNumber}</strong></p>
                            <p>Amount Due: <strong style="color: #f5576c; font-size: 18px;">₹${bill.total}</strong></p>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f0f0f0;">
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #f5576c;">Product</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #f5576c;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                        </table>
                        
                        <p style="color: #666; font-size: 14px;">
                            💳 <strong>Please complete your payment to confirm your order.</strong>
                        </p>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f5576c;">
                            <p style="color: #856404; margin: 0;">
                                Items reserved for 24 hours. Complete payment to avoid cancellation.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
                        <p>© 2024 PulseCart. All rights reserved.</p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Payment reminder email sent to ${bill.customerEmail}`);
    } catch (error) {
        console.error("❌ Error sending payment reminder email:", error.message);
        console.error("📧 Email Config - Host:", process.env.EMAIL_HOST, "User:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
    }
}

module.exports = {
    sendBillCreatedEmail,
    sendPaymentConfirmedEmail,
    sendPaymentReminderEmail,
};
