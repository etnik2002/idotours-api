const { server_error, bad_request, unauthorized } = require("../functions/responses");
const { TravelFlexTypes, IntentTypes } = require("../helpers/types");

module.exports = {

    verifyBookingFlex: async (req,res, next) => {
        try {
            const current_booking_flex = req.body.flex || req.query.flex;
            let new_flex = req.body.new_flex || req.query.new_flex;
            
            const intent = req.body.intent || req.query.intent;
            if (!Object.values(IntentTypes).includes(intent)) {
                bad_request(res, "Please specify a request intent in order to continue.", []);
            }

            if (current_booking_flex === TravelFlexTypes.NO_FLEX || !Object.values(TravelFlexTypes).includes(current_booking_flex)) {
                unauthorized(res, "Bookings without the Travel Flex option cannot be changed or canceled.");
            }

            req.intent = intent;
            req.current_booking_flex = current_booking_flex;
            req.new_flex = new_flex;
            next();

        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },



}