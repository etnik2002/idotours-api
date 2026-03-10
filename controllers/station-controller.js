const { server_error, ok, bad_request, error_404 } = require("../functions/responses");
const Station = require("../models/Station");

module.exports = {
    createStation: async (req, res) => {
        try {
            const { name, city, country, address, location, code } = req.body;
            const { operator_id } = req.params;

            const new_station = new Station({
                name,
                city,
                country,
                address,
                location,
                code,
                operator: operator_id,
            });

            if (!new_station) {
                return res.status(403).json({ message: "Error creating station." });
            }

            await new_station.save();
            return res.status(201).json({ message: "Station created successfully" });
        } catch (error) {
            return res.status(500).json(error);
        }
    },

    getByOperator: async (req, res) => {
        try {
            let { select, page = 1, limit = 10 } = req.query;
            const { operator_id } = req.params;

            page = parseInt(page);
            limit = parseInt(limit);

            const skip = (page - 1) * limit;

            const stations = await Station.find({ operator: operator_id })
                .select(select)
                .skip(skip)
                .limit(limit);

            if (!stations || stations.length === 0) {
                return ok(res, "No stations found", []);
            }

            return ok(res, "Stations data", stations);
        } catch (error) {
            return server_error(res, error || error.response.message, null);
        }
    },

    getAll: async (req, res) => {
        try {
            let { select } = req.query;

            const stations = await Station.find({})
                .select(select)

            if (!stations || stations.length === 0) {
                return ok(res, "No stations found", []);
            }

            return ok(res, "Stations data", stations);
        } catch (error) {
            return server_error(res, error || error.response.message, null);
        }
    },

    deleteById: async (req, res) => {
        try {
            const deleted = await Station.findByIdAndDelete(req.params.id);
            if (!deleted) {
                return bad_request(res, "Error deleting station", null);
            }

            ok(res, "Successfully deleted", null);
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
    },


    editById: async (req, res) => {
        try {
            const { select } = req.params;
            const current_station = await Station.findById(req.params.id).select(select);

            const data = {
                name: req.body.name || current_station.name,
                city: req.body.city || current_station.city,
                country: req.body.country || current_station.country,
                address: req.body.address || current_station.address,
                location: req.body.location || current_station.location,
                code: req.body.code || current_station.code,
            };

            const edited = await Station.findByIdAndUpdate(current_station._id, data);
            if (!edited) {
                bad_request(res, "Error editing station", null);
            }

            ok(res, "Edited successfully", null);
        } catch (error) {
            server_error(res, error || error.response.message, null);
        }
    },



};