const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const apicache = require("apicache");
const { create, getById, getByOperator, login } = require("../controllers/driver-controller");
const cache = apicache.middleware;

router.use(requestLimiter);

router.post("/create/:operator_id", create);

router.post("/login", login);

router.get("/:driver_id", cache("2 minutes"), getById);

router.get("/operator/:operator_id",cache("1 minutes"), getByOperator);

module.exports = router;