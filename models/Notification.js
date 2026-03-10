const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema({
    type: {
        type: String,
        enum: ["not_enough_seats", "general", "agency_debt", "user"],
    },
    message: {
        type: String,
    },
    title: {
        type: String,
    },
    redirect_url: {
        type: String,
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Operator',
    },
    agency: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agency',
    },
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
    },
    amount: {    
        type: Number,
    },
    is_confirmed: {
        type: Boolean,
        default: false,
    },
    is_seen: {
        type: Boolean,
        default: false,
    },
}, {timestamps: true});

module.exports = mongoose.model("Notification", notificationSchema);