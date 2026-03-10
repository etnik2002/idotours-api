const { requestLimiter } = require("../auth/limiter");
const { createTickets, getById, getByRouteNumber, getSearchedTickets, getCapacityRoutes, deactivate, reactivate, updateSeats, deleteTicket, getAvailableDates, getNearestAvailableTicket, getConnectedRoutes, getTicketForEdit, updateTicketsByRoute, getSearchedTicketsMultipleStations } = require("../controllers/ticket-controller");
const router = require("express").Router();
const apicache = require("apicache");
const cache = apicache.middleware;

router.use(requestLimiter);

router.get('/capacity-routes', cache('3 minutes'), getCapacityRoutes);

router.post("/create/:operation_id", createTickets);

router.post('/delete/:id', deleteTicket);

router.post('/deactivate/:id', deactivate);

router.post('/reactivate/:id', reactivate);

router.post("/update/seats/:id", updateSeats);

router.get("/search", cache('3 minutes'), getSearchedTickets);

router.get("/search/multiple", cache('3 minutes'), getSearchedTicketsMultipleStations);

router.get("/connected", getConnectedRoutes);

router.get("/search/available-dates", cache('2 minutes'), getAvailableDates);

router.get("/:id", cache("2 minutes"), getById);

router.get("/search/find-nearest", cache("2 minutes"), getNearestAvailableTicket);

router.get('/edit/:route_number', getTicketForEdit);

router.put('/route/:route_number', updateTicketsByRoute);

module.exports = router;