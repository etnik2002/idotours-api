const { getTotalRevenue, lastFiveBookings, getDebtOwedForOperatorByMonth, getPassengerManifest, downloadPassengerManifestPDF } = require("../controllers/operatorReports-controller");

const router = require("express").Router();

router.get('/revenue/:operator_id', getTotalRevenue)

router.get('/debt/owed/:operator_id', getDebtOwedForOperatorByMonth);

router.get('/last-five-bookings/:operator_id', lastFiveBookings)

router.get('/passenger-manifest/:operator_id', getPassengerManifest)

router.get('/passenger-manifest/download/:ticket_id', downloadPassengerManifestPDF)

module.exports = router;