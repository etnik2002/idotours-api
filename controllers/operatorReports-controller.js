const moment = require("moment-timezone");
const { server_error, ok, bad_request, unauthorized } = require("../functions/responses");
const Booking = require("../models/Booking");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const { generatePassengerManifestPDF } = require("../helpers/pdf");

module.exports = {
    getTotalRevenue: async (req, res) => {
        try {
            const operatorId = "69aedad561543c98e1b9b2ea";

            const startOfMonth = moment.utc().startOf("month").toDate()
            const endOfMonth = moment.utc().endOf("month").toDate()

            const thisMonthPipeline = [
                {
                    $match: {
                        operator: operatorId,
                        createdAt: {
                            $gte: startOfMonth,
                            $lte: endOfMonth
                        },
                        'metadata.refund_action.is_refunded': false,
                    }
                },
                {
                    $group: {
                        _id: "$operator",
                        total_revenue: {
                            $sum: { $subtract: ["$price", "$service_fee"] }
                        }
                    }
                },
                {
                    $project: {
                        revenue: "$total_revenue",
                    }
                }
            ];

            const thisMonthRevenue = await Booking.aggregate(thisMonthPipeline);


            const pipeline = [
                {
                    $match: {
                        operator: operatorId,
                        'metadata.refund_action.is_refunded': false,
                    }
                },
                {
                    $group: {
                        _id: "$operator",
                        total_revenue: {
                            $sum: { $subtract: ["$price", "$service_fee"] }
                        },
                        total_passengers: {
                            $sum: { $size: "$passengers" }
                        }
                    }
                },
                {
                    $project: {
                        revenue: "$total_revenue",
                        total_passengers: "$total_passengers"
                    }
                }
            ];

            const data = await Booking.aggregate(pipeline);

            const ticketPipeline = [
                {
                    $match: {
                        operator: operatorId,
                    }
                },
                {
                    $unwind: "$stops"
                },
                {
                    $group: {
                        _id: { from: "$stops.from", to: "$stops.to" },
                        total_views: { $sum: "$stops.views" },
                    }
                },
                {
                    $lookup: {
                        from: "stations",
                        localField: "_id.from",
                        foreignField: "_id",
                        as: "from_station"
                    }
                },
                {
                    $lookup: {
                        from: "stations",
                        localField: "_id.to",
                        foreignField: "_id",
                        as: "to_station"
                    }
                },
                {
                    $unwind: "$from_station"
                },
                {
                    $unwind: "$to_station"
                },
                {
                    $project: {
                        from_station: "$from_station.city",
                        to_station: "$to_station.city",
                        total_views: 1
                    }
                },
                {
                    $sort: { total_views: -1 }
                },
                {
                    $limit: 1
                }
            ];

            const topRoute = await Ticket.aggregate(ticketPipeline);

            ok(res, "Revenue and Top Route", { revenueData: data, topRoute, this_months_revenue: thisMonthRevenue });
        } catch (error) {
            server_error(res, '', null);
        }
    },

    getDebtOwedForOperatorByMonth: async (req, res) => {
        try {
            const { year, month } = req.query;
            if (!month) {
                return server_error(res, "Month is required in order to show reports");
            }

            const start_of_month = moment.utc().year(year).month(month).startOf('month').toDate();
            const end_of_month = moment.utc().year(year).month(month).endOf('month').toDate();

            const operator_id = "69aedad561543c98e1b9b2ea";
            if (!operator_id || operator_id === "") {
                unauthorized(res, "Not authorized", null);
            }

            const pipeline = [
                {
                    $match: {
                        operator: new mongoose.Types.ObjectId(operator_id),
                        createdAt: {
                            $gte: start_of_month,
                            $lte: end_of_month,
                        },
                        'metadata.refund_action.is_refunded': false,
                    }
                },
                {
                    $group: {
                        _id: "$operator",
                        total_debt: {
                            $sum: { $subtract: ["$price", "$service_fee"] }
                        }
                    }
                },
                {
                    $project: {
                        operator: "GOBUSLY L.L.C",
                        debt: "$total_debt"
                    }
                }
            ];

            const debts = await Booking.aggregate(pipeline);

            ok(res, `Debts for ${month}`, debts);
        } catch (error) {
            server_error(res, error.message || "An error occurred");
        }
    },

    lastFiveBookings: async (req, res) => {
        try {
            const bookings = await Booking.find({ operator: "69aedad561543c98e1b9b2ea" }).select('passengers price service_fee createdAt labels').sort({ createdAt: 'desc' }).limit(5);
            if (!bookings) {
                bad_request(res, error.message, null);
            }

            ok(res, "Last five bookings data.", bookings);
        } catch (error) {
            server_error(res, '', null);
        }
    },

    getPassengerManifest: async (req, res) => {
        try {
            const operator_id = "69aedad561543c98e1b9b2ea";
            const { date } = req.query;

            let searchDate = date ? moment.utc(date).startOf('day').toDate() : moment.utc().startOf('day').toDate();
            let endOfSearchDate = moment.utc(searchDate).endOf('day').toDate();

            const bookings = await Booking.find({
                operator: operator_id,
                departure_date: {
                    $gte: searchDate,
                    $lte: endOfSearchDate
                },
                is_paid: 'true'
            })
                .populate('ticket')
                .populate('route')
                .populate('destinations.departure_station')
                .populate('destinations.arrival_station');

            const reports = {};

            bookings.forEach(booking => {
                const ticketId = booking.ticket?._id?.toString() || 'unknown';
                if (!reports[ticketId]) {
                    reports[ticketId] = {
                        ticket_id: ticketId,
                        route_code: booking.route?.code || 'N/A',
                        route: `${booking.labels?.from_city || 'N/A'} → ${booking.labels?.to_city || 'N/A'}`,
                        departure_time: booking.ticket?.time || 'N/A',
                        departure_date: moment(booking.departure_date).format('YYYY-MM-DD'),
                        starting_station: booking.destinations?.departure_station?.name || 'N/A',
                        passengers: []
                    };
                }

                booking.passengers.forEach(p => {
                    reports[ticketId].passengers.push({
                        full_name: p.full_name,
                        phone: p.phone,
                        email: p.email,
                        price: p.price,
                        age: p.age,
                        birthdate: p.birthdate
                    });
                });
            });

            const result = Object.values(reports);
            return ok(res, "Passenger manifest generated", result);
        } catch (error) {
            console.error(error);
            return server_error(res, error.message || "An error occurred", null);
        }
    },

    downloadPassengerManifestPDF: async (req, res) => {
        try {
            const { ticket_id } = req.params;
            const { date } = req.query;

            const ticket = await Ticket.findById(ticket_id).populate('route_number');
            if (!ticket) {
                return bad_request(res, "Ticket not found", null);
            }

            let searchDate = date ? moment.utc(date).startOf('day').toDate() : moment.utc(ticket.departure_date).startOf('day').toDate();
            let endOfSearchDate = moment.utc(searchDate).endOf('day').toDate();

            const bookings = await Booking.find({
                ticket: ticket_id,
                departure_date: {
                    $gte: searchDate,
                    $lte: endOfSearchDate
                },
                is_paid: 'true'
            })
                .populate('destinations.departure_station')
                .populate('route');

            if (bookings.length === 0) {
                return bad_request(res, "No paid bookings found for this departure", null);
            }

            const manifestData = {
                route_code: ticket.route_number?.code || 'N/A',
                route: `${bookings[0].labels?.from_city || 'N/A'} → ${bookings[0].labels?.to_city || 'N/A'}`,
                departure_time: ticket.time || 'N/A',
                departure_date: moment(searchDate).format('YYYY-MM-DD'),
                starting_station: bookings[0].destinations?.departure_station?.name || 'N/A',
                passengers: []
            };

            bookings.forEach(booking => {
                booking.passengers.forEach(p => {
                    manifestData.passengers.push({
                        full_name: p.full_name,
                        phone: p.phone,
                        age: p.age
                    });
                });
            });

            const pdfBuffer = await generatePassengerManifestPDF(manifestData);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=manifest-${ticket_id}.pdf`);
            return res.send(pdfBuffer);

        } catch (error) {
            console.error(error);
            return server_error(res, error.message || "An error occurred", null);
        }
    }
};
