const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { createRoute, getByOperator, getAll, deleteById, cleanFutureTickets, getMapDisplayRoutes, disableRoute, enableRoute } = require("../controllers/route-controller");
const apicache = require("apicache");
const Route = require("../models/Route");
const cache = apicache.middleware;

router.use(requestLimiter);

router.get("/id/:id", async (req, res) => {
    try {
        return res.status(20).json({ data: await Route.findById(req.params.id), message: "" })
    } catch (error) {
        return res.status(500).json(error);
    }
})

router.post('/create/:operator_id', createRoute);

router.get("/operator/:operator_id", cache("1 minutes"), getByOperator);

router.get("/", cache("1 minutes"), getAll);

router.post('/delete/:id', deleteById);

router.post('/clean/:id', cleanFutureTickets);

router.get('/map-display', cache("20 minutes"), getMapDisplayRoutes)

router.post("/disable/:routeId", disableRoute)

router.post("/enable/:routeId", enableRoute)

module.exports = router;
