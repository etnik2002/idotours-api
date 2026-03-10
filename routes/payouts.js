const { requestPayout, getById, confirmPayout, getRecipients, getByTimePeriod, getAllPayouts } = require("../controllers/payouts-controller");

const router = require("express").Router();

router.post("/create", requestPayout);

router.get("/:id", getById);

router.get("/timeperiod/:id", getByTimePeriod);

router.post("/confirm/:id", confirmPayout);

router.get("/get/recipients", getRecipients)
router.get("/get/all", getAllPayouts)

module.exports = router;