const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const operatorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
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
    otp: {
        code: { type: String },
        valid_until: { type: Date },
    },
    role: {
        type: String,
        enum: ["operator", "employee"],
        default: "operator",
    },
    fcm_token: {
        type: String,
    },
    max_child_age: {
        type: Number,
    },
    notification_permissions: {
        allow_portal_notifications: {
            type: Boolean,
            default: true,
        },
        not_enough_seats: {
            type: Number,
            default: 6,
        },
    },
    subscriptions: {
        agencies: {
            type: Boolean,
            default: false,
        },
    },
    confirmation: [
        {
            is_confirmed: {
                type: Boolean,
                default: false,
            },
            message: {
                type: String,
            },
        }
    ],
    company_metadata: {
        tax_number: {
            type: String,
        },
        registration_number: {
            type: String,
        },
        name: {
            type: String,
        },
        email: {
            type: String,
        },
        phone: {
            type: String,
        },
        country: {
            type: String,
        },
        logo: {
            type: String,
        },
        bank_details: {
            iban: String,
            swift: String,
            bank_name: String,
        },
        payouts: {
            automatic_scheduled_payouts: { type: Boolean }
        },
        native_currency: {
            type: String
        },
        gobusly_percentage_fee: { type: Number },
    },
    averageRating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    }
}, { timestamps: true })

operatorSchema.methods.generateAuthToken = function (data) {
    data.password = undefined;
    const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
    });

    return token;
};

module.exports = mongoose.model("Operator", operatorSchema);
