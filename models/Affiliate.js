const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const affiliateSchema = mongoose.Schema({
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
        required: true
    },
    code: {
        type: String,
    },
    otp: {
        code: { type: String },
        valid_until: { type: Date },
    },
    is_active: {
        type: Boolean,
        default: false
    },
} , { timestamps : true } );

affiliateSchema.methods.generateAuthToken = function (data) {
    data.password = undefined;
    const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET);
    
    return token;
};

module.exports = mongoose.model("Affiliate", affiliateSchema);