const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const apicache = require("apicache");
const { getByOperator, sendNotification } = require("../controllers/notification-controller");
const cache = apicache.middleware;

router.use(requestLimiter);

router.get("/operator/:id", getByOperator)

router.post("/send/push", sendNotification)

module.exports = router;