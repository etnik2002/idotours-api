const router = require("express").Router();
const { register, login, countViews, getViewsCount, getBookings, getByOrigin, getById, getAll, activate, addCode } = require("../controllers/affiliate-controller");
const apicache = require("apicache");
const cache = apicache.middleware;

router.post("/register", register);

router.post("/login", login);

router.post("/views/add", cache('5 minutes'), countViews);

router.post("/activate/:id", activate);

router.post("/code/add/:id", addCode);

router.get("/views/count/:id", cache('5 minutes'), getViewsCount);

router.get("/bookings/:id", cache('5 minutes'), getBookings);

router.get('/group-origin/:id', cache('5 minutes'), getByOrigin)

router.get("/id/:id", cache('1 minute'), getById)

router.get("/all", getAll)

module.exports = router;
