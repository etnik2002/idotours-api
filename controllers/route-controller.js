require("dotenv").config()
const { default: axios } = require("axios");
const { ok, server_error, error_404 } = require("../functions/responses");
const Route = require("../models/Route");
const Ticket = require("../models/Ticket");
const PushNotifications = require("../models/PushNotifications");

module.exports = {
    createRoute: async (req, res) => {
        try {
            const { code, contact, destination, luggages, stations } = req.body;

            const mew_route = new Route({
                code,
                contact,
                destination,
                stations,
                luggages,
                operator: req.params.operator_id
            });

            if (!mew_route) {
                return res.status(403).json({ message: "Error creating route." });
            }

            await mew_route.save();
            ok(res, "Route created successfully", null);
        } catch (error) {
            return res.status(500).json(error);
        }
    },

    getAll: async (req, res) => {
        try {
            let { select, page = 1, limit = 10 } = req.query;

            page = parseInt(page);
            limit = parseInt(limit);

            const skip = (page - 1) * limit;

            const routes = await Route.find({})
                .select(select)
                .populate({
                    path: "operator",
                    select: "name"
                })
            // .skip(skip)
            // .limit(limit);

            if (!routes || routes.length === 0) {
                return ok(res, "No routes found", []);
            }

            return ok(res, "Routes data", routes);
        } catch (error) {
            return server_error(res, error.message || "Internal server error", null);
        }
    },

    deleteById: async (req, res) => {
        try {
            const deleted = await Route.findByIdAndDelete(req.params.id);
            if (!deleted) {
                return bad_request(res, "Error deleting Route", null);
            }

            const deletedTickets = await Ticket.deleteMany({ route_number: req.params.id });
            if (!deletedTickets) {
                return bad_request(res, "Error Route Tickets", null);
            }

            ok(res, "Successfully deleted", null);
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
    },

    getByOperator: async (req, res) => {
        try {
            const { operator_id } = req.params;
            const { select } = req.query;
            const routes = await Route.find({ operator: operator_id }).select(select);

            if (!routes) {
                error_404(res, "", null);
            }

            ok(res, "Routes data", routes);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    getMapDisplayRoutes: async (req, res) => {
        try {
            const routes = await Route.find({}).select("destination stations").populate('stations.from stations.to')
            if (!routes) {
                error_404(res, "No routes found", null)
            }
            ok(res, "Map display routes data", routes)
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    disableRoute: async (req, res) => {
        try {
            const disabled = await Route.findByIdAndUpdate(req.params.routeId, { 'metadata.bookable': false });
            ok(res, "Route disabled", disabled);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    enableRoute: async (req, res) => {
        try {
            const enabled = await Route.findByIdAndUpdate(req.params.routeId, { 'metadata.bookable': true });
            console.log({ enabled });

            const notifications = await PushNotifications.find({ route: enabled._id });
            console.log({ notifications });
            const response = await axios.post(`${process.env.MOBILE_BASE_API_URL}/notifications/send-route-available-notification`, notifications);
            console.log({ response: response.data });

            ok(res, "Route disabled", response);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

};