const { server_error, ok, error_404, bad_request, created } = require("../functions/responses");
const { generateTickets } = require("../functions/ticket");
const Route = require("../models/Route");
const Ticket = require("../models/Ticket");
const Booking = require("../models/Booking");
const Station = require("../models/Station");
const moment = require("moment-timezone");
const { default: mongoose } = require("mongoose");

const parseDurationToMilliseconds = (duration) => {
  const [hours = "0", minutes = "0"] = String(duration || "00:00").split(":");
  return (parseInt(hours, 10) || 0) * 60 * 60 * 1000 + (parseInt(minutes, 10) || 0) * 60 * 1000;
};

const buildStopForTicketDate = (ticket, stopInput, existingStop = {}) => {
  const existing = typeof existingStop.toObject === "function" ? existingStop.toObject() : existingStop;
  const time = stopInput.time ?? existing.time ?? ticket.time ?? "00:00";
  const maxBuyingTime = stopInput.max_buying_time ?? existing.max_buying_time ?? "00:00";
  const price = stopInput.price ?? stopInput.other_prices?.our_price ?? existing.price ?? 0;
  const childrenPrice =
    stopInput.children_price ??
    stopInput.other_prices?.our_children_price ??
    existing.children_price ??
    0;
  const returnPrice =
    stopInput.return_price ??
    stopInput.other_prices?.return_price ??
    existing.other_prices?.return_price ??
    0;
  const routeDayOfWeek = new Date(ticket.departure_date).getUTCDay() + 1;
  const [hour = "0", minute = "0"] = String(time).split(":");
  const departureDate = new Date(ticket.departure_date);

  departureDate.setUTCHours(parseInt(hour, 10) || 0, parseInt(minute, 10) || 0, 0, 0);
  if (stopInput.isTomorrow ?? existing.isTomorrow) {
    departureDate.setUTCDate(departureDate.getUTCDate() + 1);
  }

  return {
    ...existing,
    from: stopInput.from ?? existing.from,
    to: stopInput.to ?? existing.to,
    time,
    departure_date: departureDate.toISOString(),
    price,
    children_price: childrenPrice,
    max_buying_time: maxBuyingTime,
    arrival_time: new Date(departureDate.getTime() + parseDurationToMilliseconds(maxBuyingTime)),
    days_of_week: existing.days_of_week ?? [routeDayOfWeek],
    other_prices: {
      ...existing.other_prices,
      ...stopInput.other_prices,
      our_price: stopInput.other_prices?.our_price ?? price,
      our_children_price: stopInput.other_prices?.our_children_price ?? childrenPrice,
      return_price: returnPrice
    }
  };
};

module.exports = {
  createTickets: async (req, res) => {
    try {
      const { route_number, destination, time, stops, number_of_tickets, metadata, days_of_week, weeks_to_generate } = req.body;
      const ticket_data = {
        route_number,
        time,
        destination,
        stops,
        metadata,
        number_of_tickets: number_of_tickets || 13,
        operator: req.params.operation_id,
      };

      const generatedTickets = await generateTickets(ticket_data, days_of_week, weeks_to_generate, false);
      if (!generatedTickets) {
        return res.status(500).json({ message: "Error while creating tickets" });
      }

      return res.status(201).json({ message: "Ticket created successfully" });
    } catch (error) {
      return res.status(500).json(error);
    }
  },

  getById: async (req, res) => {
    try {
      const { ticket_id } = req.params;
      const { select } = req.query;
      const ticket = await Ticket.findById(ticket_id).select(select);

      if (!ticket) {
        error_404(res, "", null);
      }

      ok(res, "Ticket data", ticket);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  getNearestAvailableTicket: async (req, res) => {
    try {

      if (
        !req.query.departureStation ||
        !req.query.arrivalStation ||
        req.query.departureStation === "" ||
        req.query.arrivalStation === ""
      ) {
        return bad_request(res, "Please select stations", []);
      }

      const departureStations = req.query.departureStation.includes(',')
        ? req.query.departureStation.split(',').filter(id => id.trim())
        : [req.query.departureStation];

      const arrivalStations = req.query.arrivalStation.includes(',')
        ? req.query.arrivalStation.split(',').filter(id => id.trim())
        : [req.query.arrivalStation];

      if (departureStations.length === 0 || arrivalStations.length === 0) {
        return bad_request(res, "Please select stations", []);
      }

      const currentDate = moment(req.query.currentDate, "DD-MM-YYYY");
      if (!currentDate.isValid()) {
        return bad_request(res, "Invalid date format", []);
      }

      const adults = Number(req.query.adults);
      const children = Number(req.query.children);
      const passengers_amount = adults + children;

      const maxDatesToReturn = 5;
      const maxDaysToLookAhead = 30;

      const departureStationIds = departureStations.map(id => new mongoose.Types.ObjectId(id));
      const arrivalStationIds = arrivalStations.map(id => new mongoose.Types.ObjectId(id));

      let availableDates = [];
      let daysChecked = 0;

      while (availableDates.length < maxDatesToReturn && daysChecked < maxDaysToLookAhead) {
        daysChecked++;

        const checkDate = moment(currentDate).add(daysChecked, 'days');
        const startOfDay = moment(checkDate).startOf('day').toDate();
        const endOfDay = moment(checkDate).endOf('day').toDate();

        const pipeline = [
          {
            $match: {
              departure_date: {
                $gte: startOfDay,
                $lte: endOfDay
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
            $limit: 1
          }
        ];

        const ticketExists = await Ticket.aggregate(pipeline);

        if (ticketExists.length > 0) {
          availableDates.push(checkDate.format('DD-MM-YYYY'));
        }
      }

      if (availableDates.length === 0 && daysChecked < maxDaysToLookAhead) {
        const batchSize = 1;
        let batchStart = daysChecked + 1;

        while (availableDates.length === 0 && batchStart < maxDaysToLookAhead) {
          const batchEnd = Math.min(batchStart + batchSize - 1, maxDaysToLookAhead);

          const startDate = moment(currentDate).add(batchStart, 'days').startOf('day').toDate();
          const endDate = moment(currentDate).add(batchEnd, 'days').endOf('day').toDate();

          const pipeline = [
            {
              $match: {
                departure_date: {
                  $gte: startDate,
                  $lte: endDate
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
              $group: {
                _id: {
                  $dateToString: {
                    format: "%d-%m-%Y",
                    date: "$departure_date"
                  }
                }
              }
            },
            {
              $sort: { _id: 1 }
            },
            {
              $limit: maxDatesToReturn - availableDates.length
            }
          ];

          const batchResults = await Ticket.aggregate(pipeline);
          if (batchResults.length > 0) {
            batchResults.forEach(result => {
              availableDates.push(result._id);
            });
          }

          batchStart = batchEnd + 1;
        }
      }

      return ok(res, "Available dates found", { availableDates: availableDates });
    } catch (error) {
      server_error(res, error.message || "Internal server error", null);
    }
  },

  getPopularRoutes: async (req, res) => {
    try {
      const routes = await Ticket.find({});
    } catch (error) {
      server_error(res, error.message || "Internal server error", null);
    }
  },


  getSearchedTickets: async (req, res) => {
    try {
      if (
        req.query.departureStation === "" ||
        req.query.arrivalStation === "" ||
        !req.query.departureStation ||
        !req.query.arrivalStation
      ) {
        return bad_request(res, "Please select stations", []);
      }

      const departureDate = moment(req.query.departureDate, "DD-MM-YYYY");
      if (!departureDate.isValid()) {
        return bad_request(res, "Invalid departure date format", []);
      }

      const today = moment();
      if (today.format("DD-MM-YYYY") === departureDate.format("DD-MM-YYYY")) {
        departureDate.hours(today.hours()).minutes(today.minutes()).seconds(today.seconds());
      }

      const endOfDepartureDate = moment(departureDate).endOf("day").toDate();

      const adults = Number(req.query.adults);
      const children = Number(req.query.children);
      const passengers_amount = adults + children;

      let page = Number(req.query.page) || 1;
      let size = Number(6);
      const skipCount = (page - 1) * size;

      const pipeline = [
        {
          $match: {
            departure_date: { $gte: departureDate.toDate(), $lte: endOfDepartureDate },
            number_of_tickets: { $gte: passengers_amount },
            is_active: true,
            "stops.from": new mongoose.Types.ObjectId(req.query.departureStation),
            "stops.to": new mongoose.Types.ObjectId(req.query.arrivalStation)
          }
        },
        {
          $addFields: {
            relevantStop: {
              $filter: {
                input: "$stops",
                as: "stop",
                cond: {
                  $and: [
                    { $eq: ["$$stop.from", new mongoose.Types.ObjectId(req.query.departureStation)] },
                    { $eq: ["$$stop.to", new mongoose.Types.ObjectId(req.query.arrivalStation)] }
                  ]
                }
              }
            }
          }
        },
        {
          $match: {
            "relevantStop.0": { $exists: true }
          }
        },
        {
          $addFields: {
            all_stops: {
              input: "$stops",
              as: "all_stops"
            }
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "relevantStop.from",
            foreignField: "_id",
            as: "fromStation"
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "route.stop_sequence",
            foreignField: "_id",
            as: "stop_sequence"
          }
        },

        {
          $lookup: {
            from: "stations",
            localField: "relevantStop.to",
            foreignField: "_id",
            as: "toStation"
          }
        },
        {
          $lookup: {
            from: "routes",
            localField: "route_number",
            foreignField: "_id",
            as: "route"
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
          $addFields: {
            "relevantStop.from": { $arrayElemAt: ["$fromStation", 0] },
            "relevantStop.to": { $arrayElemAt: ["$toStation", 0] },
            route: { $arrayElemAt: ["$route", 0] },
            operatorInfo: { $arrayElemAt: ["$operatorInfo", 0] }
          }
        },
        {
          $match: {
            "route.metadata.bookable": { $ne: false }
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "route.stop_sequence",
            foreignField: "_id",
            as: "stop_sequence"
          }
        },
        {
          $project: {
            _id: 1,
            route_number: 1,
            destination: 1,
            operator: 1,
            stops: "$relevantStop",
            departure_date: 1,
            time: 1,
            type: 1,
            number_of_tickets: 1,
            is_active: 1,
            location: 1,
            metadata: 1,
            createdAt: 1,
            updatedAt: 1,
            route: 1,
            operatorInfo: 1,
            stop_sequence: 1
          }
        },
        {
          $sort: { departure_date: 1 }
        },
        {
          $skip: skipCount
        },
        {
          $limit: size
        }
      ];

      const filteredTickets = await Ticket.aggregate(pipeline);

      return ok(res, "Direct tickets found", filteredTickets);
    } catch (error) {
      return server_error(res, "An error occurred", null);
    }
  },

  getSearchedTicketsMultipleStations: async (req, res) => {
    try {
      console.log("here");
      console.log({ kfiri: req.query });

      if (
        !req.query.departureStations ||
        !req.query.arrivalStations ||
        req.query.departureStations.length === 0 ||
        req.query.arrivalStations.length === 0
      ) {
        return bad_request(res, "Please select stations", []);
      }

      const departureStations = req.query.departureStations.split(',').filter(id => id.trim());
      const arrivalStations = req.query.arrivalStations.split(',').filter(id => id.trim());
      console.log({ departureStations, arrivalStations });

      if (departureStations.length === 0 || arrivalStations.length === 0) {
        return bad_request(res, "Please select stations", []);
      }

      const departureDate = moment(req.query.departureDate, "DD-MM-YYYY");
      if (!departureDate.isValid()) {
        return bad_request(res, "Invalid departure date format", []);
      }

      const today = moment();
      if (today.format("DD-MM-YYYY") === departureDate.format("DD-MM-YYYY")) {
        departureDate.hours(today.hours()).minutes(today.minutes()).seconds(today.seconds());
      }

      const endOfDepartureDate = moment(departureDate).endOf("day").toDate();

      const adults = Number(req.query.adults);
      const children = Number(req.query.children);
      const passengers_amount = adults + children;

      let page = Number(req.query.page) || 1;
      let size = Number(6);
      const skipCount = (page - 1) * size;

      const departureStationIds = departureStations.map(id => new mongoose.Types.ObjectId(id));
      const arrivalStationIds = arrivalStations.map(id => new mongoose.Types.ObjectId(id));

      const pipeline = [
        {
          $match: {
            departure_date: { $gte: departureDate.toDate(), $lte: endOfDepartureDate },
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
          $unwind: "$relevantStops"
        },
        {
          $lookup: {
            from: "stations",
            localField: "relevantStops.from",
            foreignField: "_id",
            as: "fromStation"
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "relevantStops.to",
            foreignField: "_id",
            as: "toStation"
          }
        },
        {
          $lookup: {
            from: "routes",
            localField: "route_number",
            foreignField: "_id",
            as: "route"
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
          $addFields: {
            "relevantStops.from": { $arrayElemAt: ["$fromStation", 0] },
            "relevantStops.to": { $arrayElemAt: ["$toStation", 0] },
            route: { $arrayElemAt: ["$route", 0] },
            operatorInfo: { $arrayElemAt: ["$operatorInfo", 0] }
          }
        },
        {
          $match: {
            "route.metadata.bookable": { $ne: false }
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "route.stop_sequence",
            foreignField: "_id",
            as: "stop_sequence"
          }
        },
        {
          $group: {
            _id: "$_id",
            route_number: { $first: "$route_number" },
            destination: { $first: "$destination" },
            operator: { $first: "$operator" },
            stops: { $push: "$relevantStops" },
            departure_date: { $first: "$departure_date" },
            time: { $first: "$time" },
            type: { $first: "$type" },
            number_of_tickets: { $first: "$number_of_tickets" },
            is_active: { $first: "$is_active" },
            location: { $first: "$location" },
            metadata: { $first: "$metadata" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
            route: { $first: "$route" },
            operatorInfo: { $first: "$operatorInfo" },
            stop_sequence: { $first: "$stop_sequence" }
          }
        },
        {
          $project: {
            _id: 1,
            route_number: 1,
            destination: 1,
            operator: 1,
            stops: 1,
            departure_date: 1,
            time: 1,
            type: 1,
            number_of_tickets: 1,
            is_active: 1,
            location: 1,
            metadata: 1,
            createdAt: 1,
            updatedAt: 1,
            route: 1,
            operatorInfo: 1,
            stop_sequence: 1
          }
        },
        {
          $sort: { departure_date: 1 }
        },
        {
          $skip: skipCount
        },
        {
          $limit: size
        }
      ];

      const filteredTickets = await Ticket.aggregate(pipeline);

      return ok(res, "Direct tickets found", filteredTickets);
    } catch (error) {
      console.log(error);
      return server_error(res, "An error occurred", null);
    }
  },

  getConnectedRoutes: async (req, res) => {
    try {
      return res.status(200).json({ data: [], message: "Connected routes are disabled at the moment" })
    } catch (error) {
      console.log({ error });

      return server_error(res, "An error occurred", null);
    }
  },

  // getConnectedRoutes: async (req, res) => {
  //   try {
  //     if (
  //       req.query.departureStation === "" ||
  //       req.query.arrivalStation === "" ||
  //       !req.query.departureStation ||
  //       !req.query.arrivalStation
  //     ) {
  //       return bad_request(res, "Please select stations", []);
  //     }

  //     const startStationCountry = await Station.findById(req.query.departureStation).select("country")
  //     const endStationCountry = await Station.findById(req.query.arrivalStation).select("country")
  //     if (startStationCountry.country === endStationCountry.country) {
  //       return ok(res, "Connected routes not found", []);
  //     }

  //     const departureDate = moment.utc(req.query.departureDate, "DD-MM-YYYY");
  //     if (!departureDate.isValid()) {
  //       return bad_request(res, "Invalid departure date format", []);
  //     }

  //     const today = moment();
  //     if (today.format("DD-MM-YYYY") === departureDate.format("DD-MM-YYYY")) {
  //       departureDate.hours(today.hours()).minutes(today.minutes()).seconds(today.seconds());
  //     }


  //     const endOfDepartureDateFirstLeg = moment.utc(departureDate).endOf("day").toDate();
  //     const adults = Number(req.query.adults);
  //     const children = Number(req.query.children);
  //     const passengers_amount = adults + children;

  //     let page = Number(req.query.page) || 1;
  //     let size = Number(6);
  //     const skipCount = (page - 1) * size;

  //     const firstLegPipeline = [
  //       {
  //         $match: {
  //           "stops.departure_date": { $gte: departureDate.toDate(), $lte: endOfDepartureDateFirstLeg },
  //           "stops.from": new mongoose.Types.ObjectId(req.query.departureStation)
  //         }
  //       },
  //       {
  //         $addFields: {
  //           relevantStops: {
  //             $filter: {
  //               input: "$stops",
  //               as: "stop",
  //               cond: {
  //                 $eq: ["$$stop.from", new mongoose.Types.ObjectId(req.query.departureStation)]
  //               }
  //             }
  //           }
  //         }
  //       },
  //       {
  //         $match: {
  //           "relevantStops.0": { $exists: true }
  //         }
  //       },
  //       {
  //         $lookup: {
  //           from: "stations",
  //           localField: "relevantStops.from",
  //           foreignField: "_id",
  //           as: "fromStation"
  //         }
  //       },
  //       {
  //         $lookup: {
  //           from: "stations",
  //           localField: "relevantStops.to",
  //           foreignField: "_id",
  //           as: "toStation"
  //         }
  //       },
  //       {
  //         $lookup: {
  //           from: "routes",
  //           localField: "route_number",
  //           foreignField: "_id",
  //           as: "route"
  //         }
  //       },
  //       {
  //         $lookup: {
  //           from: "operators",
  //           localField: "operator",
  //           foreignField: "_id",
  //           as: "operatorInfo"
  //         }
  //       },
  //       {
  //         $addFields: {
  //           "relevantStops.from": { $arrayElemAt: ["$fromStation", 0] },
  //           "relevantStops.to": { $arrayElemAt: ["$toStation", 0] },
  //           route: { $arrayElemAt: ["$route", 0] },
  //           operatorInfo: { $arrayElemAt: ["$operatorInfo", 0] }
  //         }
  //       },
  //       {
  //         $limit: 50
  //       }
  //     ];

  //     const firstLegTickets = await Ticket.aggregate(firstLegPipeline);
  //     const connectedJourneys = [];
  //     const usedCombinations = new Set();

  //     for (const firstLeg of firstLegTickets) {
  //       const firstStop = firstLeg.relevantStops[0]
  //       const intermediateStationId = firstStop.to._id;
  //       const firstLegArrival = moment.utc(firstStop.arrival_time);
  //       const endOfDepartureDate = moment.utc(firstLegArrival).add(1, 'day').endOf("day").toDate();
  //       const secondLegPipeline = [
  //         {
  //           $match: {
  //             "stops.departure_date": { $gte: firstLegArrival.toDate(), $lte: endOfDepartureDate },
  //             "stops.from": intermediateStationId,
  //             "stops.to": new mongoose.Types.ObjectId(req.query.arrivalStation)
  //           }
  //         },
  //         {
  //           $addFields: {
  //             relevantStop: {
  //               $filter: {
  //                 input: "$stops",
  //                 as: "stop",
  //                 cond: {
  //                   $and: [
  //                     { $eq: ["$$stop.from", intermediateStationId] },
  //                     { $eq: ["$$stop.to", new mongoose.Types.ObjectId(req.query.arrivalStation)] }
  //                   ]
  //                 }
  //               }
  //             }
  //           }
  //         },

  //         {
  //           $match: {
  //             "relevantStop.0": { $exists: true }
  //           }
  //         },
  //         {
  //           $lookup: {
  //             from: "stations",
  //             localField: "relevantStop.from",
  //             foreignField: "_id",
  //             as: "fromStation"
  //           }
  //         },
  //         {
  //           $lookup: {
  //             from: "stations",
  //             localField: "relevantStop.to",
  //             foreignField: "_id",
  //             as: "toStation"
  //           }
  //         },
  //         {
  //           $lookup: {
  //             from: "routes",
  //             localField: "route_number",
  //             foreignField: "_id",
  //             as: "route"
  //           }
  //         },
  //         {
  //           $lookup: {
  //             from: "operators",
  //             localField: "operator",
  //             foreignField: "_id",
  //             as: "operatorInfo"
  //           }
  //         },
  //         {
  //           $addFields: {
  //             "relevantStop.from": { $arrayElemAt: ["$fromStation", 0] },
  //             "relevantStop.to": { $arrayElemAt: ["$toStation", 0] },
  //             route: { $arrayElemAt: ["$route", 0] },
  //             operatorInfo: { $arrayElemAt: ["$operatorInfo", 0] }
  //           }
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             route_number: 1,
  //             destination: 1,
  //             operator: 1,
  //             stops: "$relevantStop",
  //             departure_date: 1,
  //             time: 1,
  //             type: 1,
  //             number_of_tickets: 1,
  //             is_active: 1,
  //             location: 1,
  //             metadata: 1,
  //             createdAt: 1,
  //             updatedAt: 1,
  //             route: 1,
  //             operatorInfo: 1
  //           }
  //         },
  //         {
  //           $limit: 10
  //         }
  //       ];

  //       const secondLegTickets = await Ticket.aggregate(secondLegPipeline);

  //       for (const secondLeg of secondLegTickets) {
  //         const combinationKey = `${firstLeg._id}_${secondLeg._id}`;
  //         if (usedCombinations.has(combinationKey)) {
  //           continue;
  //         }

  //         const firstLegArrival = moment.utc(firstStop.arrival_time);
  //         const secondLegDeparture = moment.utc(secondLeg?.stops[0]?.departure_date);
  //         const diff = secondLegDeparture.diff(firstLegArrival, 'minutes')
  //         if (secondLegDeparture.diff(firstLegArrival, 'minutes') >= 30) {
  //           usedCombinations.add(combinationKey);
  //           const connectedJourney = {
  //             _id: `conn_${firstLeg._id}_${secondLeg._id}`,
  //             type: "connected",
  //             total_duration: secondLegDeparture.diff(moment.utc(firstLeg.departure_date), 'minutes'),
  //             connection_time: secondLegDeparture.diff(firstLegArrival, 'minutes'),
  //             total_price: (firstStop.price || 0) + (secondLeg.stops[0]?.price || 0),
  //             total_children_price: (firstStop.children_price || 0) + (secondLeg.stops[0]?.children_price || 0),
  //             intermediate_station: {
  //               _id: intermediateStationId,
  //               name: firstStop.to.name,
  //               city: firstStop.to.city,
  //               country: firstStop.to.country
  //             },
  //             legs: [
  //               {
  //                 leg_number: 1,
  //                 ticket: firstLeg._id,
  //                 operator: {
  //                   _id: firstLeg.operator,
  //                   name: firstLeg.operatorInfo?.name,
  //                   company_name: firstLeg.operatorInfo?.company_metadata?.name
  //                 },
  //                 route: firstStop.route,
  //                 from_station: firstStop.from,
  //                 to_station: firstStop.to,
  //                 departure_date: firstStop.departure_date,
  //                 arrival_time: firstStop.arrival_time,
  //                 time: firstStop.time,
  //                 price: firstStop.price,
  //                 children_price: firstStop.children_price,
  //                 number_of_tickets: firstLeg.number_of_tickets,
  //                 metadata: firstLeg.metadata
  //               },
  //               {
  //                 leg_number: 2,
  //                 ticket: secondLeg._id,
  //                 operator: {
  //                   _id: secondLeg.operator,
  //                   name: secondLeg.operatorInfo?.name,
  //                   company_name: secondLeg.operatorInfo?.company_metadata?.name
  //                 },
  //                 route: secondLeg.route,
  //                 from_station: secondLeg.stops[0].from,
  //                 to_station: secondLeg.stops[0].to,
  //                 departure_date: secondLeg.stops[0].departure_date,
  //                 arrival_time: secondLeg.stops[0].arrival_time,
  //                 time: secondLeg.stops[0].time || secondLeg.time,
  //                 price: secondLeg.stops[0].price,
  //                 children_price: secondLeg.stops[0].children_price,
  //                 number_of_tickets: secondLeg.number_of_tickets,
  //                 metadata: secondLeg.metadata
  //               }
  //             ]
  //           };

  //           connectedJourneys.push(connectedJourney);
  //         }
  //       }
  //     }

  //     connectedJourneys.sort((a, b) => a.connection_time - b.connection_time);

  //     return ok(res, "Connected routes found", connectedJourneys);

  //   } catch (error) {
  //     return server_error(res, "An error occurred while searching for connected routes", null);
  //   }
  // },

  getAvailableDates: async (req, res) => {
    try {
      if (
        req.query.departureStation === "" ||
        req.query.arrivalStation === "" ||
        !req.query.departureStation ||
        !req.query.arrivalStation
      ) {
        return bad_request(res, "Please select stations", []);
      }

      const departureDate = moment(req.query.departureDate, "DD-MM-YYYY");
      if (!departureDate.isValid()) {
        return bad_request(res, "Invalid departure date format", []);
      }

      const today = moment();
      if (today.format("DD-MM-YYYY") === departureDate.format("DD-MM-YYYY")) {
        departureDate.hours(today.hours()).minutes(today.minutes()).seconds(today.seconds());
      }

      const endOfDepartureDate = moment(departureDate).endOf("day").toDate();

      const adults = Number(req.query.adults);
      const children = Number(req.query.children);
      const passengers_amount = adults + children;

      let page = Number(req.query.page) || 1;
      let size = Number(6);
      const skipCount = (page - 1) * size;

      const pipeline = [
        {
          $match: {
            departure_date: { $gte: departureDate.toDate(), $lte: endOfDepartureDate },
            number_of_tickets: { $gt: passengers_amount },
            is_active: true,
          }
        },
        {
          $unwind: "$stops"
        },
        {
          $match: {
            "stops.from": new mongoose.Types.ObjectId(req.query.departureStation),
            "stops.to": new mongoose.Types.ObjectId(req.query.arrivalStation)
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "stops.from",
            foreignField: "_id",
            as: "stops.from"
          }
        },
        {
          $lookup: {
            from: "stations",
            localField: "stops.to",
            foreignField: "_id",
            as: "stops.to"
          }
        },
        {
          $lookup: {
            from: "operators",
            localField: "operator",
            foreignField: "_id",
            as: "operator_info"
          }
        },
        {
          $unwind: "$stops.from"
        },
        {
          $unwind: "$stops.to"
        },
        {
          $project: {
            departure_date: "$stops.departure_date",
            price: "$stops.other_prices.our_price",
            children_price: "$stops.other_prices.our_children_price",
            operator_info: { $arrayElemAt: ["$operator_info", 0] }
          }
        },
        {
          $sort: { departure_date: 1 }
        },
        {
          $skip: skipCount
        },
        {
          $limit: size
        }
      ];

      const tickets = await Ticket.aggregate(pipeline);

      return ok(res, "Direct tickets found", tickets);
    } catch (error) {
      return server_error(res, "An error occurred", null);
    }
  },

  saveNewDepartureDate: async (req, res) => {
    try {
      const updated_booking = await Booking.findByIdAndUpdate(req.params.booking_id, {
        $set: { operator: req.body.operator_id, departure_date: req.body.new_departure_date },
      });

      if (!updated_booking) {
        return res.status(403).json({ message: "Could not update booking, please contact us.", data: null });
      }

      ok(res, "Booking updated successfully", null);
    } catch (error) {
      return server_error(res, "An error occurred", null);
    }
  },

  getCapacityRoutes: async (req, res) => {
    try {
      let startDate = req.query.startDate;
      let endDate = req.query.endDate;

      startDate = new Date(startDate);
      endDate = new Date(endDate);

      endDate.setDate(endDate.getDate() + 1);

      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(0, 0, 0, 0);

      const allLineIDS = req.query.line.split('-');

      const allBookings = await Booking.find({ operator: req.query.operator_id, departure_date: { $gte: startDate }, route: allLineIDS }).select("passengers ticket");
      let ticketsWithBookings = [];

      for (const line of allLineIDS) {
        if (line !== "") {
          const line_id = new mongoose.Types.ObjectId(line);

          const ticketQuery = {
            departure_date: { $gte: startDate, $lte: endDate },
            route_number: line_id,
            operator: req.query.operator_id
          };

          const ticketsForLine = await Ticket.find(ticketQuery)
            .populate({
              path: 'route_number',
              populate: [
                { path: 'stations.from' },
                { path: 'stations.to' }
              ]
            })
            .sort({ departure_date: 'asc' });

          const ticketsForLineWithBookings = ticketsForLine.map((ticket) => {
            const ticketObject = ticket.toObject();
            const bookingsForTicket = allBookings.filter(
              (booking) => booking.ticket.toString() === ticket._id.toString()
            );
            return {
              ticket: ticketObject,
              bookings: bookingsForTicket
            };
          });

          ticketsWithBookings.push(...ticketsForLineWithBookings);
        }
      }

      ticketsWithBookings.sort((a, b) => new Date(a.ticket.date) - new Date(b.ticket.date));
      ok(res, "Capacity data", ticketsWithBookings)
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  deleteTicket: async (req, res) => {
    try {
      const deleted = await Ticket.findByIdAndDelete(req.params.id);
      if (!deleted) {
        bad_request(res, "Could not delete route", null);
      }

      ok(res, "Route deleted", true);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  deactivate: async (req, res) => {
    try {
      const updated = await Ticket.findByIdAndUpdate(req.params.id, { $set: { is_active: false } });
      if (!updated) {
        bad_request(res, "Could not deactivate route", null);
      }

      ok(res, "Route deactivated", true);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  reactivate: async (req, res) => {
    try {
      const updated = await Ticket.findByIdAndUpdate(req.params.id, { $set: { is_active: true } });
      if (!updated) {
        bad_request(res, "Could not reactivate route", null);
      }

      ok(res, "Route reactivated", true);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  updateSeats: async (req, res) => {
    try {
      const seats = req.query.seats;
      const updated = await Ticket.findByIdAndUpdate(req.params.id, { $set: { number_of_tickets: seats } });
      if (!updated) {
        bad_request(res, "", null)
      }

      ok(res, "Seats updated", null);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  generateFutureTicketsAutomatically: async (req, res) => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const lines = await Route.find({ generate_tickets_automatically: true }).select("_id");

      const latestTicketsForEachLine = await Promise.all(
        lines.map(line =>
          Ticket.findOne({ route_number: line._id })
            .select("date stops")
            .sort({ departure_date: -1 })
            .lean()
        )
      );

      const validTickets = latestTicketsForEachLine.filter(Boolean);

      if (validTickets.length < 1) {
        error_404(res, "No tickets found", []);
      }

      const newTickets = validTickets.map(latestTicket => {
        const latestTicketDate = new Date(latestTicket.date);
        const dayOfWeek = latestTicketDate.getUTCDay() + 1;

        const futureDate = new Date(latestTicketDate);
        futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 2);

        while (futureDate.getUTCDay() + 1 !== dayOfWeek) {
          futureDate.setUTCDate(futureDate.getUTCDate() + 1);
        }

        const newTicketData = {
          ...latestTicket,
          _id: undefined,
          date: futureDate.toISOString(),
          stops: latestTicket.stops.map(stop => ({
            ...stop,
            departure_date: new Date(new Date(stop.date).getTime() + (futureDate - latestTicketDate)).toISOString(),
            arrival_time: new Date(new Date(stop.arrivalTimestamp).getTime() + (futureDate - latestTicketDate)).toISOString(),
          }))
        };

        return newTicketData;
      });

      created(res, `Created ${newTickets.length} new tickets`, newTickets);

    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }

  },


  updateTicketsByRoute: async (req, res) => {
    try {
      const { route_number } = req.params;
      const updateData = req.body;

      const currentDate = new Date();

      const futureTickets = await Ticket.find({
        route_number: route_number,
        departure_date: { $gte: currentDate }
      }).sort({ departure_date: 1 });

      if (futureTickets.length === 0) {
        return res.status(404).json({ message: "No future tickets found for this route" });
      }

      const updateFields = {};

      if (updateData.destination) {
        updateFields.destination = updateData.destination;
      }

      if (updateData.time) {
        updateFields.time = updateData.time;
      }

      if (updateData.number_of_tickets) {
        updateFields.number_of_tickets = updateData.number_of_tickets;
      }

      if (updateData.metadata) {
        updateFields.metadata = updateData.metadata;
      }

      if (updateData.stops && Array.isArray(updateData.stops)) {
        if (updateData.replace_stops) {
          for (const ticket of futureTickets) {
            const updatedStops = updateData.stops.map((stopInput, index) =>
              buildStopForTicketDate(ticket, stopInput, ticket.stops[index])
            );
            const ticketUpdateFields = { ...updateFields };

            if (updateData.time) {
              const [hour = "0", minute = "0"] = String(updateData.time).split(":");
              const departureDate = new Date(ticket.departure_date);
              departureDate.setUTCHours(parseInt(hour, 10) || 0, parseInt(minute, 10) || 0, 0, 0);
              ticketUpdateFields.departure_date = departureDate.toISOString();
            }

            await Ticket.findByIdAndUpdate(ticket._id, {
              ...ticketUpdateFields,
              stops: updatedStops
            });
          }
        } else {
          for (const ticket of futureTickets) {
            const updatedStops = ticket.stops.map((stop, index) => {
              if (updateData.stops[index]) {
                const updatedStop = { ...stop.toObject() };

              if (updateData.stops[index].price !== undefined) {
                updatedStop.price = updateData.stops[index].price;
              }

              if (updateData.stops[index].children_price !== undefined) {
                updatedStop.children_price = updateData.stops[index].children_price;
              }

              if (updateData.stops[index].max_buying_time !== undefined) {
                updatedStop.max_buying_time = updateData.stops[index].max_buying_time;

                const stopDate = new Date(updatedStop.departure_date);
                const arrivalTimeHours = updateData.stops[index].max_buying_time.split(":")[0];
                const arrivalTimeMinutes = updateData.stops[index].max_buying_time.split(":")[1];
                const arrivalTimeMilliseconds = arrivalTimeHours * 60 * 60 * 1000 + arrivalTimeMinutes * 60 * 1000;
                updatedStop.arrival_time = new Date(stopDate.getTime() + arrivalTimeMilliseconds);
              }

              if (updateData.stops[index].time !== undefined) {
                updatedStop.time = updateData.stops[index].time;

                const ticketDate = new Date(ticket.departure_date);
                const hour = updateData.stops[index].time.split(":")[0];
                const minute = updateData.stops[index].time.split(":")[1];
                ticketDate.setUTCHours(parseInt(hour), parseInt(minute), 0, 0);

                if (updatedStop.isTomorrow) {
                  ticketDate.setUTCDate(ticketDate.getUTCDate() + 1);
                }

                updatedStop.departure_date = ticketDate.toISOString();

                if (updatedStop.max_buying_time) {
                  const arrivalTimeHours = updatedStop.max_buying_time.split(":")[0];
                  const arrivalTimeMinutes = updatedStop.max_buying_time.split(":")[1];
                  const arrivalTimeMilliseconds = arrivalTimeHours * 60 * 60 * 1000 + arrivalTimeMinutes * 60 * 1000;
                  updatedStop.arrival_time = new Date(ticketDate.getTime() + arrivalTimeMilliseconds);
                }
              }

              if (updateData.stops[index].other_prices) {
                updatedStop.other_prices = {
                  ...updatedStop.other_prices,
                  ...updateData.stops[index].other_prices
                };
              }

              return updatedStop;
            }
            return stop;
          });

            await Ticket.findByIdAndUpdate(ticket._id, {
              ...updateFields,
              stops: updatedStops
            });
          }
        }
      } else {
        await Ticket.updateMany(
          {
            route_number: route_number,
            departure_date: { $gte: currentDate }
          },
          { $set: updateFields }
        );
      }

      return res.status(200).json({
        message: "Tickets updated successfully",
        updated_count: futureTickets.length
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  getTicketForEdit: async (req, res) => {
    try {
      const { route_number } = req.params;

      const currentDate = new Date();

      const ticket = await Ticket.findOne({
        route_number: route_number,
        departure_date: { $gte: currentDate }
      })
        .sort({ departure_date: 1 })
        .populate('route_number')
        .populate('stops.from')
        .populate('stops.to');

      if (!ticket) {
        return res.status(404).json({ message: "No future tickets found for this route" });
      }

      return res.status(200).json(ticket);

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  getByRouteAndDate: async (req, res) => {
    try {
      const { route_number } = req.params;
      const { date } = req.query;

      if (!route_number || !date) {
        return bad_request(res, "Route number and date are required", null);
      }

      const departureDate = moment(date, "DD-MM-YYYY");
      if (!departureDate.isValid()) {
        return bad_request(res, "Invalid date format. Use DD-MM-YYYY", null);
      }

      const startOfDay = moment(departureDate).startOf("day").toDate();
      const endOfDay = moment(departureDate).endOf("day").toDate();

      const ticket = await Ticket.findOne({
        route_number: route_number,
        departure_date: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate("route_number")
        .populate("stops.from")
        .populate("stops.to")
        .populate("operator");

      if (!ticket) {
        return error_404(res, "Ticket not found for this route and date", null);
      }

      ok(res, "Ticket found", ticket);
    } catch (error) {
      server_error(res, error.message || "Internal server error", null);
    }
  }
};
