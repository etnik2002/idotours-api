const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { createStation, getAll, getByOperator, deleteById, editById } = require("../controllers/station-controller");
const apicache = require("apicache");
const cache = apicache.middleware;
router.use(requestLimiter);

router.post('/create', createStation);

router.get("/", getAll);

router.get("/operator/:operator_id", getByOperator);

router.post("/delete/:id", deleteById);

router.post("/edit/:id", editById);

module.exports = router;