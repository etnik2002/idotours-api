const { default: mongoose } = require("mongoose");
const { normalizeCountry } = require("../functions/country");
const { ok, bad_request } = require("../functions/responses");
const Route = require("../models/Route");
const Station = require("../models/Station");
const Ticket = require("../models/Ticket");

module.exports = {
    getCountryCities: async (req, res) => {
        try {
            let { countrySlug } = req.params;

            if (countrySlug === "north macedonia") {
                countrySlug = "North Macedonia";
            }

            if (!countrySlug) {
                return res.status(400).json({ message: "Country parameter is required." });
            }

            const stations = await Station.find({
                country: { $regex: new RegExp(`^${countrySlug}$`, "i") }
            }).select("city name");

            console.log({ stations });

            const allCities = stations
                .map(station => ({ city: station.city, station_name: station.name }))
                .filter(Boolean);

            console.log({ allCities });

            const uniqueCities = [
                ...new Map(allCities.map(item => [item.city, item])).values()
            ];

            console.log({ uniqueCities });

            ok(res, `Cities in ${countrySlug}`, {
                cities: uniqueCities,
                count: uniqueCities.length
            });

        } catch (error) {
            return res.status(500).json({ message: "Internal server error." });
        }
    },



    getCityRelations: async (req, res) => {
        try {
            const { citySlug } = req.params;

            const [city, destinationCities] = await Promise.all([
                Station.findOne({ city: citySlug }).select("city _id").lean(),
                Station.aggregate([
                    {
                        $match: { city: citySlug }
                    },
                    {
                        $lookup: {
                            from: 'tickets',
                            let: { stationId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        is_active: true,
                                        'stops.from': { $exists: true }
                                    }
                                },
                                {
                                    $unwind: '$stops'
                                },
                                {
                                    $match: {
                                        $expr: { $eq: ['$stops.from', '$$stationId'] }
                                    }
                                },
                                {
                                    $project: { destinationId: '$stops.to' }
                                }
                            ],
                            as: 'tickets'
                        }
                    },
                    {
                        $unwind: '$tickets'
                    },
                    {
                        $lookup: {
                            from: 'stations',
                            localField: 'tickets.destinationId',
                            foreignField: '_id',
                            as: 'destStation'
                        }
                    },
                    {
                        $unwind: '$destStation'
                    },
                    {
                        $group: {
                            _id: '$destStation.city',
                            stationId: { $first: '$destStation._id' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            city: '$_id',
                            _id: '$stationId'
                        }
                    }
                ])
            ]);

            if (!city) {
                return res.status(404).json({ message: "City not found." });
            }

            return res.status(200).json({
                city: {
                    name: city.city,
                    _id: city._id
                },
                relations: destinationCities
            });

        } catch (error) {
            console.error("Error in getCityRelations:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    },

    getAllCountries: async (req, res) => {
        try {
            const stations = await Station.find({}).select("country");
            console.log({ stations });

            const countryCounts = {};
            for (const station of stations) {
                const country = normalizeCountry(station.country);
                if (!country) continue;
                countryCounts[country] = (countryCounts[country] || 0) + 1;
            }

            const result = Object.entries(countryCounts)
                .map(([country, count]) => ({ country, stationCount: count }))
                .sort((a, b) => a.country.localeCompare(b.country));

            console.log({ result });

            ok(res, "All countries with station counts", result);
        } catch (error) {
            console.error("Error in getAllCountries:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    },

    validateRoute: async (req, res) => {
        try {
            const { departureStation, arrivalStation } = req.query;

            if (!departureStation || !arrivalStation) {
                return bad_request(res, "Stations are required", []);
            }

            const fromStation = await Station.findOne({ city: departureStation }).select("_id");
            const toStation = await Station.findOne({ city: arrivalStation }).select("_id");

            if (!fromStation || !toStation) {
                return bad_request(res, "Invalid station cities provided", []);
            }

            const matchQuery = {
                is_active: true,
                "stops.from": fromStation._id,
                "stops.to": toStation._id,
            };

            console.log({ matchQuery });

            const exists = await Ticket.exists(matchQuery);
            console.log({ exists });

            if (exists) {
                return ok(res, "Route exists", { exists: true });
            } else {
                return ok(res, "Route does not exist", { exists: false });
            }

        } catch (error) {
            console.error("Error in validating route:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    }



};

