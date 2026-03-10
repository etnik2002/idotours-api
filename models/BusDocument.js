const mongoose = require("mongoose");

const busDocumentSchema = mongoose.Schema({
    images: [],
    valid_until: { type: Date },
    expires_at: { type: Date },
    is_alerted: { type: Boolean, default: false }
});


module.exports = mongoose.model("BusDocument", busDocumentSchema);