const mongoose = require("mongoose");

const depositSchema = mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    appwrite_user_id: {
        type: String,
    },
    amount_in_cents: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    payment_intent_id: {
        type: String,
    },
        
    
} , { timestamps : true });

module.exports = mongoose.model("Deposit", depositSchema);
