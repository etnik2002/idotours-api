const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const mongoose = require("mongoose");
const Station = require("../models/Station");
const Route = require("../models/Route");
const Ticket = require("../models/Ticket");
const Operator = require("../models/Operator");
const moment = require("moment-timezone");

const server = new McpServer({
    name: "gobusly-mcp",
    version: "1.0.0"
});

server.tool(
    "get_countries_with_bus_routes",
    "Get all countries where bus routes are available. Returns a list of countries with their cities and stations.",
    {},
    async () => {
        try {
            const stations = await Station.find({}).select("name city country address location").lean();
            
            const countriesMap = {};
            
            for (const station of stations) {
                const country = station.country || "Unknown";
                if (!countriesMap[country]) {
                    countriesMap[country] = {
                        country: country,
                        cities: {}
                    };
                }
                
                const city = station.city || "Unknown";
                if (!countriesMap[country].cities[city]) {
                    countriesMap[country].cities[city] = [];
                }
                
                countriesMap[country].cities[city].push({
                    id: station._id.toString(),
                    name: station.name,
                    address: station.address,
                    location: station.location
                });
            }
            
            const result = Object.values(countriesMap).map(countryData => ({
                country: countryData.country,
                cities: Object.entries(countryData.cities).map(([cityName, stations]) => ({
                    city: cityName,
                    stations: stations
                }))
            }));
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Countries with bus routes",
                            total_countries: result.length,
                            data: result
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

server.tool(
    "get_cities_in_country",
    "Get all cities and stations in a specific country",
    {
        country: {
            type: "string",
            description: "The name of the country to get cities for (e.g., 'Germany', 'Macedonia', 'Switzerland')"
        }
    },
    async ({ country }) => {
        try {
            const stations = await Station.find({ 
                country: { $regex: new RegExp(country, 'i') } 
            }).select("name city country address location").lean();
            
            if (stations.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: `No stations found in country: ${country}`,
                                suggestion: "Try using the get_countries_with_bus_routes tool to see all available countries"
                            })
                        }
                    ]
                };
            }
            
            const citiesMap = {};
            for (const station of stations) {
                const city = station.city || "Unknown";
                if (!citiesMap[city]) {
                    citiesMap[city] = [];
                }
                citiesMap[city].push({
                    id: station._id.toString(),
                    name: station.name,
                    address: station.address,
                    location: station.location
                });
            }
            
            const result = Object.entries(citiesMap).map(([cityName, stations]) => ({
                city: cityName,
                stations_count: stations.length,
                stations: stations
            }));
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            country: country,
                            total_cities: result.length,
                            total_stations: stations.length,
                            cities: result
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

server.tool(
    "search_bus_routes",
    "Search for available bus tickets between two cities. Provide city names and optionally a departure date.",
    {
        from_city: {
            type: "string",
            description: "Departure city name (e.g., 'Skopje', 'Berlin', 'Zurich')"
        },
        to_city: {
            type: "string",
            description: "Arrival city name (e.g., 'Berlin', 'Munich', 'Vienna')"
        },
        departure_date: {
            type: "string",
            description: "Optional departure date in DD-MM-YYYY format. If not provided, searches for the next 7 days."
        },
        adults: {
            type: "number",
            description: "Number of adult passengers (default: 1)"
        },
        children: {
            type: "number",
            description: "Number of child passengers (default: 0)"
        }
    },
    async ({ from_city, to_city, departure_date, adults = 1, children = 0 }) => {
        try {
            const departureStations = await Station.find({
                city: { $regex: new RegExp(from_city, 'i') }
            }).select("_id name city country").lean();
            
            const arrivalStations = await Station.find({
                city: { $regex: new RegExp(to_city, 'i') }
            }).select("_id name city country").lean();
            
            if (departureStations.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: `No stations found in departure city: ${from_city}`,
                                suggestion: "Try using get_countries_with_bus_routes to find available cities"
                            })
                        }
                    ]
                };
            }
            
            if (arrivalStations.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: `No stations found in arrival city: ${to_city}`,
                                suggestion: "Try using get_countries_with_bus_routes to find available cities"
                            })
                        }
                    ]
                };
            }
            
            const departureStationIds = departureStations.map(s => s._id);
            const arrivalStationIds = arrivalStations.map(s => s._id);
            
            let searchDate;
            if (departure_date) {
                searchDate = moment(departure_date, "DD-MM-YYYY");
                if (!searchDate.isValid()) {
                    searchDate = moment().startOf('day');
                }
            } else {
                searchDate = moment().startOf('day');
            }
            
            const endSearchDate = moment(searchDate).add(7, 'days').endOf('day').toDate();
            const passengers_amount = adults + children;
            
            const pipeline = [
                {
                    $match: {
                        departure_date: { 
                            $gte: searchDate.toDate(), 
                            $lte: endSearchDate 
                        },
                        number_of_tickets: { $gte: passengers_amount },
                        is_active: true
                    }
                },
                {
                    $addFields: {
                        relevantStops: {
                            $filter: {
                                input: "$stops",
                                as: "stop",
                                cond: {
                                    $and: [
                                        { $in: ["$$stop.from", departureStationIds] },
                                        { $in: ["$$stop.to", arrivalStationIds] }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        "relevantStops.0": { $exists: true }
                    }
                },
                {
                    $lookup: {
                        from: "operators",
                        localField: "operator",
                        foreignField: "_id",
                        as: "operatorInfo"
                    }
                },
                {
                    $lookup: {
                        from: "routes",
                        localField: "route_number",
                        foreignField: "_id",
                        as: "routeInfo"
                    }
                },
                {
                    $unwind: "$relevantStops"
                },
                {
                    $lookup: {
                        from: "stations",
                        localField: "relevantStops.from",
                        foreignField: "_id",
                        as: "fromStationInfo"
                    }
                },
                {
                    $lookup: {
                        from: "stations",
                        localField: "relevantStops.to",
                        foreignField: "_id",
                        as: "toStationInfo"
                    }
                },
                {
                    $addFields: {
                        operatorInfo: { $arrayElemAt: ["$operatorInfo", 0] },
                        routeInfo: { $arrayElemAt: ["$routeInfo", 0] },
                        fromStationInfo: { $arrayElemAt: ["$fromStationInfo", 0] },
                        toStationInfo: { $arrayElemAt: ["$toStationInfo", 0] }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        departure_date: 1,
                        departure_time: "$relevantStops.time",
                        arrival_time: "$relevantStops.arrival_time",
                        price: "$relevantStops.price",
                        children_price: "$relevantStops.children_price",
                        available_seats: "$number_of_tickets",
                        ticket_type: "$type",
                        from_station: {
                            name: "$fromStationInfo.name",
                            city: "$fromStationInfo.city",
                            country: "$fromStationInfo.country",
                            address: "$fromStationInfo.address"
                        },
                        to_station: {
                            name: "$toStationInfo.name",
                            city: "$toStationInfo.city",
                            country: "$toStationInfo.country",
                            address: "$toStationInfo.address"
                        },
                        operator: {
                            name: "$operatorInfo.name",
                            company_name: "$operatorInfo.company_metadata.name",
                            rating: "$operatorInfo.averageRating",
                            total_reviews: "$operatorInfo.totalReviews"
                        },
                        route_code: "$routeInfo.code",
                        features: "$metadata.features",
                        luggages: "$routeInfo.luggages",
                        contact: "$routeInfo.contact"
                    }
                },
                {
                    $sort: { departure_date: 1 }
                },
                {
                    $limit: 20
                }
            ];
            
            const tickets = await Ticket.aggregate(pipeline);
            
            if (tickets.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `No bus tickets found from ${from_city} to ${to_city} in the next 7 days`,
                                searched_from: from_city,
                                searched_to: to_city,
                                searched_date_range: `${searchDate.format('DD-MM-YYYY')} to ${moment(endSearchDate).format('DD-MM-YYYY')}`,
                                suggestion: "Try different dates or check if there are routes available using get_all_routes tool"
                            })
                        }
                    ]
                };
            }
            
            const formattedTickets = tickets.map(ticket => ({
                ticket_id: ticket._id.toString(),
                departure: {
                    date: moment(ticket.departure_date).format('DD-MM-YYYY'),
                    time: ticket.departure_time,
                    station: ticket.from_station
                },
                arrival: {
                    time: ticket.arrival_time ? moment(ticket.arrival_time).format('HH:mm') : null,
                    station: ticket.to_station
                },
                pricing: {
                    adult_price: ticket.price,
                    child_price: ticket.children_price,
                    currency: "EUR"
                },
                availability: {
                    seats_available: ticket.available_seats,
                    ticket_type: ticket.ticket_type
                },
                operator: ticket.operator,
                route_code: ticket.route_code,
                features: ticket.features || [],
                luggage_policy: ticket.luggages,
                contact: ticket.contact
            }));
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `Found ${formattedTickets.length} bus tickets from ${from_city} to ${to_city}`,
                            search_params: {
                                from: from_city,
                                to: to_city,
                                date_range: `${searchDate.format('DD-MM-YYYY')} to ${moment(endSearchDate).format('DD-MM-YYYY')}`,
                                passengers: { adults, children }
                            },
                            tickets: formattedTickets
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

server.tool(
    "get_all_routes",
    "Get all available bus routes in the system with their origin and destination cities",
    {},
    async () => {
        try {
            const routes = await Route.find({ is_active: true })
                .populate('stations.from', 'name city country')
                .populate('stations.to', 'name city country')
                .populate('operator', 'name company_metadata.name')
                .populate('stop_sequence', 'name city country')
                .lean();
            
            const formattedRoutes = routes.map(route => ({
                route_id: route._id.toString(),
                route_code: route.code,
                origin: route.stations?.from ? {
                    station: route.stations.from.name,
                    city: route.stations.from.city,
                    country: route.stations.from.country
                } : { text: route.destination?.from },
                destination: route.stations?.to ? {
                    station: route.stations.to.name,
                    city: route.stations.to.city,
                    country: route.stations.to.country
                } : { text: route.destination?.to },
                operator: route.operator ? {
                    name: route.operator.name,
                    company: route.operator.company_metadata?.name
                } : null,
                stops: route.stop_sequence?.map(stop => ({
                    station: stop.name,
                    city: stop.city,
                    country: stop.country
                })) || [],
                luggage_policy: route.luggages,
                contact: route.contact,
                is_bookable: route.metadata?.bookable !== false
            }));
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "All available bus routes",
                            total_routes: formattedRoutes.length,
                            routes: formattedRoutes
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

server.tool(
    "get_ticket_details",
    "Get detailed information about a specific ticket by its ID",
    {
        ticket_id: {
            type: "string",
            description: "The ID of the ticket to get details for"
        }
    },
    async ({ ticket_id }) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticket_id)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: "Invalid ticket ID format"
                            })
                        }
                    ]
                };
            }
            
            const ticket = await Ticket.findById(ticket_id)
                .populate('operator', 'name company_metadata averageRating totalReviews')
                .populate('route_number', 'code contact luggages stop_sequence destination')
                .populate('stops.from', 'name city country address location')
                .populate('stops.to', 'name city country address location')
                .lean();
            
            if (!ticket) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: "Ticket not found"
                            })
                        }
                    ]
                };
            }
            
            const formattedTicket = {
                ticket_id: ticket._id.toString(),
                route_code: ticket.route_number?.code,
                departure_date: moment(ticket.departure_date).format('DD-MM-YYYY'),
                departure_time: ticket.time,
                ticket_type: ticket.type,
                available_seats: ticket.number_of_tickets,
                is_active: ticket.is_active,
                destination: ticket.destination,
                stops: ticket.stops?.map(stop => ({
                    from: {
                        name: stop.from?.name,
                        city: stop.from?.city,
                        country: stop.from?.country,
                        address: stop.from?.address
                    },
                    to: {
                        name: stop.to?.name,
                        city: stop.to?.city,
                        country: stop.to?.country,
                        address: stop.to?.address
                    },
                    departure_time: stop.time,
                    arrival_time: stop.arrival_time ? moment(stop.arrival_time).format('HH:mm DD-MM-YYYY') : null,
                    price: stop.price,
                    children_price: stop.children_price,
                    days_of_week: stop.days_of_week
                })) || [],
                operator: ticket.operator ? {
                    name: ticket.operator.name,
                    company_name: ticket.operator.company_metadata?.name,
                    rating: ticket.operator.averageRating,
                    total_reviews: ticket.operator.totalReviews
                } : null,
                luggage_policy: ticket.route_number?.luggages,
                contact: ticket.route_number?.contact,
                features: ticket.metadata?.features || [],
                message: ticket.metadata?.message
            };
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            ticket: formattedTicket
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

server.tool(
    "get_available_dates",
    "Get available dates for a specific route between two cities in the next 30 days",
    {
        from_city: {
            type: "string",
            description: "Departure city name"
        },
        to_city: {
            type: "string",
            description: "Arrival city name"
        },
        adults: {
            type: "number",
            description: "Number of adult passengers (default: 1)"
        },
        children: {
            type: "number",
            description: "Number of child passengers (default: 0)"
        }
    },
    async ({ from_city, to_city, adults = 1, children = 0 }) => {
        try {
            const departureStations = await Station.find({
                city: { $regex: new RegExp(from_city, 'i') }
            }).select("_id").lean();
            
            const arrivalStations = await Station.find({
                city: { $regex: new RegExp(to_city, 'i') }
            }).select("_id").lean();
            
            if (departureStations.length === 0 || arrivalStations.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: `Could not find stations for ${from_city} or ${to_city}`
                            })
                        }
                    ]
                };
            }
            
            const departureStationIds = departureStations.map(s => s._id);
            const arrivalStationIds = arrivalStations.map(s => s._id);
            const passengers_amount = adults + children;
            
            const startDate = moment().startOf('day').toDate();
            const endDate = moment().add(30, 'days').endOf('day').toDate();
            
            const pipeline = [
                {
                    $match: {
                        departure_date: { $gte: startDate, $lte: endDate },
                        number_of_tickets: { $gte: passengers_amount },
                        is_active: true
                    }
                },
                {
                    $addFields: {
                        relevantStops: {
                            $filter: {
                                input: "$stops",
                                as: "stop",
                                cond: {
                                    $and: [
                                        { $in: ["$$stop.from", departureStationIds] },
                                        { $in: ["$$stop.to", arrivalStationIds] }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        "relevantStops.0": { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$departure_date"
                            }
                        },
                        count: { $sum: 1 },
                        min_price: { $min: { $arrayElemAt: ["$relevantStops.price", 0] } }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ];
            
            const availableDates = await Ticket.aggregate(pipeline);
            
            const formattedDates = availableDates.map(date => ({
                date: moment(date._id).format('DD-MM-YYYY'),
                day_of_week: moment(date._id).format('dddd'),
                available_trips: date.count,
                starting_price: date.min_price
            }));
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `Available dates for ${from_city} to ${to_city}`,
                            route: { from: from_city, to: to_city },
                            passengers: { adults, children },
                            total_available_dates: formattedDates.length,
                            dates: formattedDates
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    }
                ]
            };
        }
    }
);

async function initializeMCP() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GoBusly MCP Server is running");
}

module.exports = { initializeMCP, server };