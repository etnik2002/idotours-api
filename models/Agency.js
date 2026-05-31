const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const agencySchema = mongoose.Schema({
    name: {
        type: String,
        required: true
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
    role: {
        type: String,
        enum: ["agency"],
        default: "agency",
    },
    address: {
        city: {
            type: String,
        },
        country: {
            type: String,
        },
        street: {
            type: String,
        },
    },
    contact: {
        phone: {
            type: String
        },
        contact_email: {
            type: String
        },
    },
    financial_data: {
        percentage: {
            type: Number,
        },
        total_sales: {
            type: Number,
        },
        profit: {
            type: Number,
        },
        debt: {
            type: Number,
        },
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    is_applicant: {
        type: Boolean
    },
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

    },
    otp: {
        code: { type: String },
        valid_until: { type: Date },
    },
}, { timestamps: true });

agencySchema.methods.generateAuthToken = function (data) {
    data.password = undefined;
    const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET);

    return token;
};

module.exports = mongoose.model("Agency", agencySchema);
