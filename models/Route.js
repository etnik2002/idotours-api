const mongoose = require("mongoose");

const routeSchema = mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    contact: {
        phone: {
            type: String,
        },
        email: {
            type: String,
        },
    },
    destination: {
        from: {
            type: String
        },
        to: {
            type: String
        },
    },
    stations: {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Station"
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Station"
        },
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Operator",
    },
    luggages: {
        free: {
            type: Number,
        },
        price_for_extra: {
            type: Number,
        },
        size: {
            type: String,
        },
    },
    stop_sequence: [{ type: mongoose.Schema.Types.ObjectId, ref: "Station" }],
    is_active: {
        type: Boolean,
        default: true,
    },
    generate_tickets_automatically: {
        type: Boolean,
        default: true,
    },
    metadata: {
        sold: {
            type: Number,
        },
        message: {
            type: String
        },
        bookable: {
            type: Boolean
        }
    },
}, { timestamps: true });

module.exports = mongoose.model("Route", routeSchema);