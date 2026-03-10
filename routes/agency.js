const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { validateOperatorForCreations } = require("../auth/operator");
const { createAgency, login, getById, getAll, getByOperator } = require("../controllers/agency-controller");

router.use(requestLimiter);

router.get("/", getAll);

router.post('/create/:operator_id', createAgency);

router.post("/login", login);

router.get("/:id", getById);

router.get("/operator/:operator_id", getByOperator);

module.exports = router;