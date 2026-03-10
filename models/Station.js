const mongoose = require("mongoose");

const stationSchema = mongoose.Schema({
    name: {
        type: String,
    },
    city: {
        type: String,
    },
    country: {
        type: String,
    },
    address: {
        type: String,
    },
    location: {
        lat: {
            type: Number,
        },
        lng: {
            type: Number,
        },
    },

    code: {
        type: String,
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Operator",
    },
}, { timestamps: true })

module.exports = mongoose.model("Station", stationSchema);