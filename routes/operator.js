const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { createOperator, login, getById, getAll, getOperatorLivechatMessages, edit, changeAutomaticPayoutSchedule } = require("../controllers/operator-controller");

router.use(requestLimiter);

router.post('/create', createOperator);

router.post("/edit/:id", edit)

router.post("/login", login);

router.get("/:id", getById);

router.get("/", getAll);

router.post('/automatic-payouts/:operatorId', changeAutomaticPayoutSchedule)

router.get("/messages/:operator_id", getOperatorLivechatMessages)

module.exports = router;