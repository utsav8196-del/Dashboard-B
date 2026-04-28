const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ["bill_created", "payment_confirmed", "payment_reminder"],
            unique: true,
        },
        subject: {
            en: { type: String, required: true },
            hi: { type: String },
        },
        htmlContent: {
            en: { type: String, required: true },
            hi: { type: String },
        },
        textContent: {
            en: { type: String },
            hi: { type: String },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
