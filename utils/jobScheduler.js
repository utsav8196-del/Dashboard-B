const schedule = require("node-schedule");
const Bill = require("../models/Bill");
const {
    sendPaymentReminderEmail,
} = require("./emailService");

// ✅ STORE SCHEDULED JOBS
const scheduledJobs = new Map();

// ✅ SCHEDULE EMAIL 1 HOUR AFTER BILL CREATION
function schedulePaymentReminder(bill) {
    try {
        // Schedule for 1 hour from now
        const reminderTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        const jobId = `reminder-${bill._id}`;

        // Cancel existing job if any
        if (scheduledJobs.has(jobId)) {
            scheduledJobs.get(jobId).cancel();
        }

        // Schedule new job
        const job = schedule.scheduleJob(reminderTime, async () => {
            try {
                // Fetch the latest bill data
                const latestBill = await Bill.findById(bill._id);

                // Only send reminder if payment is still pending
                if (latestBill && latestBill.paymentStatus === "pending") {
                    await sendPaymentReminderEmail(latestBill);
                    console.log(`✅ Scheduled reminder email sent for bill ${bill.billNumber}`);
                }

                // Remove from scheduled jobs map
                scheduledJobs.delete(jobId);
            } catch (error) {
                console.error(`❌ Error in scheduled job for ${jobId}:`, error.message);
            }
        });

        scheduledJobs.set(jobId, job);
        console.log(`⏰ Payment reminder scheduled for ${reminderTime} (Bill: ${bill.billNumber})`);
    } catch (error) {
        console.error("❌ Error scheduling payment reminder:", error.message);
    }
}

// ✅ CANCEL SCHEDULED REMINDER
function cancelPaymentReminder(billId) {
    try {
        const jobId = `reminder-${billId}`;
        if (scheduledJobs.has(jobId)) {
            scheduledJobs.get(jobId).cancel();
            scheduledJobs.delete(jobId);
            console.log(`✅ Scheduled reminder cancelled for bill ${billId}`);
        }
    } catch (error) {
        console.error("❌ Error cancelling scheduled reminder:", error.message);
    }
}

module.exports = {
    schedulePaymentReminder,
    cancelPaymentReminder,
};
