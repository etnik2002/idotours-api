const mongoose = require("mongoose");

const driverDocumentSchema = mongoose.Schema({
    images: [],
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver"
    },
    valid_until: { type: Date },
    expires_at: { type: Date },
    is_alerted: { type: Boolean, default: false }

});


module.exports = mongoose.model("DriverDocument", driverDocumentSchema);