const { createTransfer, getAllRecipients } = require("../functions/banking.config");
const { server_error, created, ok } = require("../functions/responses");
const Payout = require("../models/Payouts");

module.exports = {
    requestPayout: async (req, res) => {
        try {
            const data = {
                operator_id: req.body.operator_id || req.query.operator_id,
                requested_amount_in_cents: req.body.requested_amount_in_cents || req.query.requested_amount_in_cents,
                paid_amount_in_cents: req.body.paid_amount_in_cents || req.query.paid_amount_in_cents,
                payment_status: req.body.payment_status || req.query.payment_status,
                paid_at: req.body.paid_at || req.query.paid_at,
                reference_umber: req.body.reference_umber || req.query.reference_umber,
                notes: req.body.notes || req.query.notes,
                transaction_Id: req.body.transaction_Id || req.query.transaction_Id,
                is_confirmed_by_gobusly: false,
                time_period: {
                    month: req.body.month || req.query.month,
                    year: req.body.year || req.query.year
                }
            }

            const payoutRequest = new Payout(data);
            await payoutRequest.save();
            created(res, "Payout request was successfull!", payoutRequest);

        } catch (error) {
            server_error(res, error.message);
        }
    },

    getAllPayouts: async (req, res) => {
        try {
            const payouts = await Payout.find({})
                .populate('operator_id')
            console.log({ payouts });

            ok(res, "", payouts);
        } catch (error) {
            server_error(res, error.message);
        }
    }
    ,

    getById: async (req, res) => {
        try {
            const payout = await Payout.findById(req.params.id);
            ok(res, "", payout);
        } catch (error) {
            server_error(res, error.message);
        }
    },

    confirmPayout: async (req, res) => {
        try {
            // mas konfirmimit duhet tbohen kejt rest calls qerat xhi kan mbet per ti bo transfer paret pi te bonka jon te e operatorit
            const transfer = await createTransfer(req.body);
            const confirmed = await Payout.findByIdAndUpdate(
                req.params.id,
                { is_confirmed_by_gobusly: true },
                { new: true }
            );


            if (!confirmed) {
                return res.status(404).send('Payout not found');
            }
            ok(res, "Payout confirmed by GOBUSLY", confirmed);
        } catch (error) {
            server_error(res);
        }
    },

    getByTimePeriod: async (req, res) => {
        try {
            const operatorId = req.params.id;
            const year = req.query.year;
            const month = req.query.month;

            const pRequests = await Payout.find({
                operator_id: operatorId,
                'time_period.year': year,
                'time_period.month': month
            });

            ok(res, "", pRequests);
        } catch (error) {
            server_error(res);
        }
    },


    getRecipients: async (req, res) => {
        try {
            const recipients = await getAllRecipients("P83846827");
            ok(res, "", recipients);
        } catch (error) {
            server_error(res, error.response.message || error.message);
        }
    }
}