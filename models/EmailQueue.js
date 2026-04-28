const mongoose = require("mongoose");

const emailQueueSchema = new mongoose.Schema(
    {
        recipientEmail: {
            type: String,
            required: true,
        },
        recipientName: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            required: true,
        },
        htmlContent: {
            type: String,
            required: true,
        },
        templateName: {
            type: String,
            enum: ["bill_created", "payment_confirmed", "payment_reminder"],
        },
        billId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bill",
        },
        status: {
            type: String,
            enum: ["pending", "sent", "failed"],
            default: "pending",
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3,
        },
        lastError: {
            type: String,
        },
        sentAt: {
            type: Date,
        },
        nextRetryAt: {
            type: Date,
        },
        language: {
            type: String,
            default: "en",
            enum: ["en", "hi"],
        },
    },
    { timestamps: true }
);

// Index for finding pending emails to process
emailQueueSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model("EmailQueue", emailQueueSchema);
