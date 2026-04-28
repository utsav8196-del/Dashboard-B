const nodemailer = require("nodemailer");
const EmailQueue = require("../models/EmailQueue");
const EmailTemplate = require("../models/EmailTemplate");

// ✅ VERIFY EMAIL CREDENTIALS
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn("⚠️  WARNING: EMAIL_USER or EMAIL_PASSWORD not set in .env file");
}

// ✅ CONFIGURE NODEMAILER (GMAIL) - PRODUCTION READY
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASSWORD?.trim().replace(/\s+/g, ""),
    },
    tls: {
        rejectUnauthorized: false,
    },
});

// ✅ VERIFY TRANSPORTER CONNECTION
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ SMTP Email Configuration Error:", error.message);
        console.error("📧 Please check your EMAIL_USER and EMAIL_PASSWORD in .env");
    } else {
        console.log("✅ SMTP Server ready for sending emails");
    }
});

// ✅ GET EMAIL TEMPLATE
async function getEmailTemplate(templateName, language = "en") {
    try {
        const template = await EmailTemplate.findOne({
            name: templateName,
            isActive: true,
        });

        if (!template) {
            console.warn(`⚠️  Template not found: ${templateName}`);
            return null;
        }

        return {
            subject: template.subject[language] || template.subject.en,
            htmlContent: template.htmlContent[language] || template.htmlContent.en,
        };
    } catch (error) {
        console.error("❌ Error fetching email template:", error.message);
        return null;
    }
}

// ✅ ADD EMAIL TO QUEUE
async function addToEmailQueue(emailData) {
    try {
        const queueItem = new EmailQueue({
            recipientEmail: emailData.recipientEmail,
            recipientName: emailData.recipientName,
            subject: emailData.subject,
            htmlContent: emailData.htmlContent,
            templateName: emailData.templateName,
            billId: emailData.billId,
            language: emailData.language || "en",
        });

        await queueItem.save();
        console.log(`📧 Email queued for ${emailData.recipientEmail}`);
        return queueItem;
    } catch (error) {
        console.error("❌ Error adding email to queue:", error.message);
    }
}

// ✅ SEND EMAIL FROM QUEUE (With Retry Logic)
async function sendEmailFromQueue(queueItem) {
    try {
        // Check max attempts
        if (queueItem.attempts >= queueItem.maxAttempts) {
            queueItem.status = "failed";
            queueItem.lastError = "Max attempts reached";
            await queueItem.save();
            console.error(`❌ Email failed after ${queueItem.maxAttempts} attempts: ${queueItem.recipientEmail}`);
            return false;
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: queueItem.recipientEmail,
            subject: queueItem.subject,
            html: queueItem.htmlContent,
        };

        await transporter.sendMail(mailOptions);

        // Mark as sent
        queueItem.status = "sent";
        queueItem.sentAt = new Date();
        await queueItem.save();

        console.log(`✅ Email sent to ${queueItem.recipientEmail}`);
        return true;
    } catch (error) {
        // Increment attempts and set retry time
        queueItem.attempts += 1;
        queueItem.lastError = error.message;
        queueItem.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // Retry after 5 minutes

        if (queueItem.attempts >= queueItem.maxAttempts) {
            queueItem.status = "failed";
        } else {
            queueItem.status = "pending";
        }

        await queueItem.save();
        console.error(`❌ Error sending email (Attempt ${queueItem.attempts}/${queueItem.maxAttempts}):`, error.message);
        return false;
    }
}

// ✅ PROCESS PENDING EMAILS (Run periodically)
async function processPendingEmails() {
    try {
        const pendingEmails = await EmailQueue.find({
            status: "pending",
            nextRetryAt: { $lte: new Date() },
        }).limit(10);

        console.log(`📧 Processing ${pendingEmails.length} pending emails...`);

        for (const email of pendingEmails) {
            await sendEmailFromQueue(email);
        }

        return pendingEmails.length;
    } catch (error) {
        console.error("❌ Error processing pending emails:", error.message);
    }
}

// ✅ SEND BILL CREATED EMAIL
async function sendBillCreatedEmail(bill, language = "en") {
    try {
        const template = await getEmailTemplate("bill_created", language);

        if (!template) {
            console.warn(`⚠️  Using fallback template for bill_created`);
            return await sendBillCreatedEmailFallback(bill, language);
        }

        let htmlContent = template.htmlContent;

        // Replace variables
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

        htmlContent = htmlContent
            .replace("{{customerName}}", bill.customerName)
            .replace("{{billNumber}}", bill.billNumber)
            .replace("{{items}}", itemsHTML)
            .replace("{{subtotal}}", bill.subtotal)
            .replace("{{tax}}", bill.tax)
            .replace("{{discount}}", bill.discount)
            .replace("{{total}}", bill.total)
            .replace("{{date}}", new Date(bill.createdAt).toLocaleString());

        await addToEmailQueue({
            recipientEmail: bill.customerEmail,
            recipientName: bill.customerName,
            subject: template.subject,
            htmlContent,
            templateName: "bill_created",
            billId: bill._id,
            language,
        });
    } catch (error) {
        console.error("❌ Error in sendBillCreatedEmail:", error.message);
    }
}

// ✅ SEND PAYMENT CONFIRMED EMAIL
async function sendPaymentConfirmedEmail(bill, language = "en") {
    try {
        const template = await getEmailTemplate("payment_confirmed", language);

        if (!template) {
            return await sendPaymentConfirmedEmailFallback(bill, language);
        }

        let htmlContent = template.htmlContent;

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

        htmlContent = htmlContent
            .replace("{{customerName}}", bill.customerName)
            .replace("{{billNumber}}", bill.billNumber)
            .replace("{{items}}", itemsHTML)
            .replace("{{subtotal}}", bill.subtotal)
            .replace("{{tax}}", bill.tax)
            .replace("{{discount}}", bill.discount)
            .replace("{{total}}", bill.total)
            .replace("{{paymentMethod}}", bill.paymentMethod.toUpperCase())
            .replace("{{date}}", new Date(bill.createdAt).toLocaleString());

        await addToEmailQueue({
            recipientEmail: bill.customerEmail,
            recipientName: bill.customerName,
            subject: template.subject,
            htmlContent,
            templateName: "payment_confirmed",
            billId: bill._id,
            language,
        });
    } catch (error) {
        console.error("❌ Error in sendPaymentConfirmedEmail:", error.message);
    }
}

// ✅ SEND PAYMENT REMINDER EMAIL
async function sendPaymentReminderEmail(bill, language = "en") {
    try {
        const template = await getEmailTemplate("payment_reminder", language);

        if (!template) {
            return await sendPaymentReminderEmailFallback(bill, language);
        }

        let htmlContent = template.htmlContent;

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

        htmlContent = htmlContent
            .replace("{{customerName}}", bill.customerName)
            .replace("{{billNumber}}", bill.billNumber)
            .replace("{{items}}", itemsHTML)
            .replace("{{total}}", bill.total);

        await addToEmailQueue({
            recipientEmail: bill.customerEmail,
            recipientName: bill.customerName,
            subject: template.subject,
            htmlContent,
            templateName: "payment_reminder",
            billId: bill._id,
            language,
        });
    } catch (error) {
        console.error("❌ Error in sendPaymentReminderEmail:", error.message);
    }
}

// ✅ FALLBACK TEMPLATES (If DB templates not found)
async function sendBillCreatedEmailFallback(bill, language) {
    const translations = {
        en: {
            subject: `📦 Your Bill #${bill.billNumber} - Payment Pending`,
            title: "🛒 Bill Created Successfully",
            message: "Thank you for your order! Your bill has been created and is waiting for payment.",
        },
        hi: {
            subject: `📦 आपका बिल #${bill.billNumber} - भुगतान लंबित`,
            title: "🛒 बिल सफलतापूर्वक बनाया गया",
            message: "आपकी ऑर्डर के लिए धन्यवाद! आपका बिल बनाया जा चुका है और भुगतान के लिए प्रतीक्षा कर रहा है।",
        },
    };

    const t = translations[language] || translations.en;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">${t.title}</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                <p>Hi <strong>${bill.customerName}</strong>,</p>
                <p>${t.message}</p>
                <p><strong>Bill #${bill.billNumber}</strong> - Amount: <strong>₹${bill.total}</strong></p>
            </div>
        </div>
    `;

    await addToEmailQueue({
        recipientEmail: bill.customerEmail,
        recipientName: bill.customerName,
        subject: t.subject,
        htmlContent,
        templateName: "bill_created",
        billId: bill._id,
        language,
    });
}

async function sendPaymentConfirmedEmailFallback(bill, language) {
    const translations = {
        en: {
            subject: `✅ Payment Confirmed - Order #${bill.billNumber}`,
            title: "✅ Payment Received Successfully",
        },
        hi: {
            subject: `✅ भुगतान की पुष्टि हुई - ऑर्डर #${bill.billNumber}`,
            title: "✅ भुगतान सफलतापूर्वक प्राप्त हुआ",
        },
    };

    const t = translations[language] || translations.en;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">${t.title}</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                <p>Hi <strong>${bill.customerName}</strong>,</p>
                <p>🎉 Your payment has been received and your order is confirmed!</p>
                <p><strong>Bill #${bill.billNumber}</strong> - Amount Paid: <strong>₹${bill.total}</strong></p>
            </div>
        </div>
    `;

    await addToEmailQueue({
        recipientEmail: bill.customerEmail,
        recipientName: bill.customerName,
        subject: t.subject,
        htmlContent,
        templateName: "payment_confirmed",
        billId: bill._id,
        language,
    });
}

async function sendPaymentReminderEmailFallback(bill, language) {
    const translations = {
        en: {
            subject: `⏰ Payment Reminder - Bill #${bill.billNumber}`,
            title: "⏰ Payment Reminder",
        },
        hi: {
            subject: `⏰ भुगतान अनुस्मारक - बिल #${bill.billNumber}`,
            title: "⏰ भुगतान अनुस्मारक",
        },
    };

    const t = translations[language] || translations.en;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">${t.title}</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                <p>Hi <strong>${bill.customerName}</strong>,</p>
                <p>This is a friendly reminder that your bill is still pending payment.</p>
                <p><strong>Bill #${bill.billNumber}</strong> - Amount Due: <strong style="color: #f5576c;">₹${bill.total}</strong></p>
            </div>
        </div>
    `;

    await addToEmailQueue({
        recipientEmail: bill.customerEmail,
        recipientName: bill.customerName,
        subject: t.subject,
        htmlContent,
        templateName: "payment_reminder",
        billId: bill._id,
        language,
    });
}

module.exports = {
    sendBillCreatedEmail,
    sendPaymentConfirmedEmail,
    sendPaymentReminderEmail,
    addToEmailQueue,
    processPendingEmails,
    getEmailTemplate,
};
