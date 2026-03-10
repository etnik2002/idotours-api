const mongoose = require('mongoose');

const payoutsSchema = new mongoose.Schema({
    operator_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Operator', 
        required: true,
    },
    requested_amount_in_cents: {
        type: Number,
        required: true,
    },
    paid_amount_in_cents: {
        type: Number,
        default: 0, 
    },
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending', 
    },
    time_period: {
        month: {type: String},
        year: {type: String},
    },
    paid_at: {
        type: Date,
    },
    reference_umber: {
        type: String,
        unique: true, 
    },
    notes: {
        type: String,
    },
    transaction_d: {
        type: String, 
    },
    is_confirmed_by_gobusly: {
        type: Boolean,
    },
}, {timestamps:true});

module.exports = mongoose.model('Payouts', payoutsSchema);
