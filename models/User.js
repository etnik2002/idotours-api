const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = mongoose.Schema({
    name: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
    },
    otp: {
        code: { type: String },
        valid_until: { type: Date },
    },
    fcm_token: {
        type: String,
    },
    points: {
        type: Number,
    },
    balance_in_cents: {
        type: Number,
        default: 0,
    },
    appwrite_id: {
        type: String,
    },
    stripe_customer_id: {
        type: String,
    },
    stripe_payment_method_ids: [],
    notifications: {
        booking_confirmations: { type: Boolean, default: true },
        departure_reminders: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
        account_updates: { type: Boolean, default: true },
        sms: {
            departure_reminders: { type: Boolean, default: true },
            promotions: { type: Boolean, default: true },
        }
    }
}, { timestamps: true });

userSchema.methods.generateAuthToken = function (data) {
    data.password = undefined;
    const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
    });

    return token;
};


module.exports = mongoose.model("User", userSchema);