const { default: mongoose, mongo } = require("mongoose");

const PushNotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    title: { type: String, required: false },
    content: { type: String, required: true },
    url: { type: String },

    type: {
        type: String,
        enum: [
            "ROUTE_AVAILABLE_FOR_BUY",
        ],
        default: "ROUTE_AVAILABLE_FOR_BUY",
        required: true,
    },
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    push_token: { type: String, required: true },

    departure_station_id: { type: mongoose.Schema.Types.ObjectId, ref: "Station" },
    arrival_station_id: { type: mongoose.Schema.Types.ObjectId, ref: "Station" },

    sent: { type: Boolean },
}, { timestamps: true });

module.exports = new mongoose.model("PushNotification", PushNotificationSchema)