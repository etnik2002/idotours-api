const { ok } = require("../functions/responses");
const Voucher = require("../models/Voucher");


module.exports = {

    create: async (req,res) => {
        try {
            const newVoucher = new Voucher({
                code: req.body.code || 'SUMMER2024',
                description: req.body.description || '10% off on summer collection',
                value: req.body.value || 10,
                use_as_coupon_code: req.body.use_as_coupon_code,
                total_quantity: req.body.total_quantity || 3,
                expiration_date: req.body.expiration_date || new Date()
              });
              
              await newVoucher.save();
              ok(res, "Created", newVoucher)
        } catch (error) {
            return res.status(500).json({message: error.message, data: null})
        }
    },

    claim: async (req,res) => {
        try {
            const voucher = await Voucher.findById(req.params.voucher_id);
            const claimed = await voucher.claim(req.params.user_id);
            return ok(res, "Voucher claimed", claimed)
        } catch (error) {
            return res.status(500).json({message: error.message, data: null})
        }
    }    

}