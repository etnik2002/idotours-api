const router = require("express").Router();
const { createRecipient, sendMoney, getRecipients } = require("../controllers/banking-controller");


router.get("/recepients/get-all", getRecipients);

router.post("/recepients/create", createRecipient);

router.post("/money/transfer/create", sendMoney);

module.exports = router;