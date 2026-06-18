const router = require("express").Router();

const { verifyBookingFlex } = require("../auth/booking");
const { requestLimiter } = require("../auth/limiter");
const { getByRoute, getByOperator, getByAgencyId, getAll, create, createAgencyBooking, createManualBooking, getByUserId, generateETicketForMobileAPI, scanBoardingPass, retreiveBookingByIdAndEmail, getByIdClient, getByIdOperator, editBookingDetails, cancelBookingAndRefund, rescheduleBooking, getByIds, downloadEBooking, upgradeTravelFlex, getTotalBookingsCountByOperatorId, downloadEBookingMobileAPI, deleteBookingByOperator } = require("../controllers/booking-controller");
const apicache = require("apicache");
const { saveNewDepartureDate } = require("../controllers/ticket-controller");
const { refund } = require("../controllers/payment-controller");
const cache = apicache.middleware;

router.use(requestLimiter);

router.get("/all", getAll);

router.get("/ids/:ids", getByIds);

router.post('/download/pdf/e-ticket/:booking_id', downloadEBooking)

router.post('/download/pdf/mobile/:booking_id', downloadEBookingMobileAPI)

router.post("/create/:operator_id/:user_id/:ticket_id", create);

router.post("/create-manual", createManualBooking);
router.post("/create-agency/:agency_id/:ticket_id", createAgencyBooking);

router.post('/:booking_id/upgrade-flex', upgradeTravelFlex)

router.post('/change/departure-date/:booking_id', saveNewDepartureDate)

router.get('/count/operator/:operator_id', getTotalBookingsCountByOperatorId)

router.get('/client/:id', getByIdClient);

router.get("/retreive/id-email/:booking_id/:passenger_email", retreiveBookingByIdAndEmail)

router.get('/operator/with_charge/:id', cache("2 minutes"), getByIdOperator);

router.get("/route/:route_number", cache("2 minutes"), getByRoute);

router.get("/user/:user_id", cache("1 minutes"), getByUserId);

router.get("/operator/:operator_id", getByOperator);

router.get("/agency/:agency_id", getByAgencyId);

router.delete("/operator/:operator_id/:booking_id", deleteBookingByOperator);

router.post("/scan/boarding-pass/:driver_id/:booking_id/:passenger_id", scanBoardingPass);

router.post("/edit/details/:id", verifyBookingFlex, editBookingDetails);

router.post("/cancel-and-refund/:booking_id/:payment_intent_id", verifyBookingFlex, refund, cancelBookingAndRefund);

router.post("/reschedule/:id", verifyBookingFlex, rescheduleBooking);

router.post("/gererate-e-ticket/:booking_id", generateETicketForMobileAPI)

module.exports = router;
