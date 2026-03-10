const mongoose = require("mongoose");

const affiliateViewsSchema = mongoose.Schema({
    origin: {
        type: String,
    },
    affiliate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Affiliate',
    },
} , { timestamps : true } );



module.exports = mongoose.model("AffiliateViews", affiliateViewsSchema);