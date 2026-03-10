const Ticket = require("../models/Ticket");
const moment = require("moment")

const generateTickets = async (ticketData, selectedDaysOfWeek, weeksToGenerateTicketsFor, is_single_ticket) => {
  const adjustDayOfWeek = (startDate, dayOfWeek) => {
    const adjustedDate = new Date(startDate);
    adjustedDate.setUTCDate(startDate.getUTCDate() + ((dayOfWeek + 6 - startDate.getUTCDay()) % 7));
    return adjustedDate;
  };

  const tickets = [];

  for (const selectedDayOfWeek of selectedDaysOfWeek) {
    const frankfurtTimezone = 'Europe/Berlin';
    const startDateString = new Date().toLocaleString('en-US', { timeZone: frankfurtTimezone });
    const startDate = new Date(startDateString);

    let ticketDate = adjustDayOfWeek(startDate, selectedDayOfWeek);
    let weeks_to_generate = Number(weeksToGenerateTicketsFor);

    if (is_single_ticket) {
      weeks_to_generate = 1;
    }

    for (let i = 0; i < weeks_to_generate; i++) {
      const ticketDateWithZeroHours = new Date(ticketDate);
      const firstStartHour = ticketData.time.split(":")[0];
      const firstStartMins = ticketData.time.split(":")[1];
      ticketDateWithZeroHours.setUTCHours(parseInt(firstStartHour), parseInt(firstStartMins), 0, 0);

      const ticketDateString = ticketDateWithZeroHours.toISOString();
      const ticketDataWithDate = {
        ...ticketData,
        departure_date: ticketDateString,
      };

      const stopsWithTime = ticketDataWithDate.stops.map((stop) => {
        const stopDate = new Date(ticketDateString);
        const hour = stop.time.split(":")[0];
        const minute = stop.time.split(":")[1];

        stopDate.setUTCHours(parseInt(hour), parseInt(minute), 0, 0);

        if (stop.isTomorrow) {
          stopDate.setUTCDate(stopDate.getUTCDate() + 1);
        }

        let arrivalTimeDate;
        // max_buying_time duhet t permirsohet ene tbohet duration, ama nfrontend osh si bug ene e kom lon kshau niher
        let arrivalTimeHours = stop.max_buying_time.split(":")[0];
        let arrivalTimeMinutes = stop.max_buying_time.split(":")[1];

        const arrivalTimeMilliseconds = arrivalTimeHours * 60 * 60 * 1000 + arrivalTimeMinutes * 60 * 1000;
        arrivalTimeDate = new Date(stopDate.getTime() + arrivalTimeMilliseconds);

        const stopTimestampMilliseconds = stopDate.getTime();
        return {
          ...stop,
          time: stop.time,
          departure_date: stopDate.toISOString(),
          arrival_time: arrivalTimeDate,
          days_of_week: selectedDayOfWeek,
          other_prices: {
            our_price: stop?.price,
            our_children_price: stop?.children_price,
            return_price: stop?.return_price

            // our_price: stop?.price <= 50 ? stop?.price * 1.10 : stop?.price * 1.07,
            // our_children_price: stop?.children_price <= 50 ? stop?.children_price * 1.10 : stop?.children_price * 1.07
          },
        };
      });

      const ticketWithStops = {
        ...ticketDataWithDate,
        stops: stopsWithTime,

      };

      tickets.push(ticketWithStops);

      ticketDate.setUTCDate(ticketDate.getUTCDate() + 7);
    }
  }


  await Ticket.insertMany(tickets);
  return tickets;
};

function findConnectedRoutes(tickets, startStationId, endStationId, departureDate, maxTransfers = 2) {
  const graph = buildGraph(tickets);
  const routes = [];

  function dfs(currentStationId, endStationId, path = [], departureTime = moment(departureDate), transfers = 0) {
    if (transfers > maxTransfers) return;
    if (currentStationId === endStationId) {
      routes.push(path);
      return;
    }

    if (!graph[currentStationId]) return;

    for (const connection of graph[currentStationId]) {
      if (moment(connection.departure_date).isBefore(departureTime)) continue;

      const newPath = [...path, connection];
      const newTransfers = path.length > 0 && path[path.length - 1].operator !== connection.operator
        ? transfers + 1
        : transfers;

      dfs(connection.to._id.toString(), endStationId, newPath, moment(connection.arrival_date), newTransfers);
    }
  }

  dfs(startStationId, endStationId);

  return routes;
}

function buildGraph(tickets) {
  const graph = {};
  tickets.forEach(ticket => {
    ticket.stops.forEach((stop, index) => {
      if (index < ticket.stops.length - 1) {
        const fromStationId = stop.from._id.toString();

        if (!graph[fromStationId]) graph[fromStationId] = [];

        graph[fromStationId].push({
          from: stop.from,
          to: ticket.stops[index + 1].to,
          departure_date: stop.departure_date,
          arrival_date: ticket.stops[index + 1].arrival_date,
          price: stop.price,
          operator: ticket.operator,
          ticket_id: ticket._id
        });
      }
    });
  });
  return graph;
}

function formatConnectedRoute(route) {
  const firstLeg = route[0];
  const lastLeg = route[route.length - 1];

  return {
    stops: route.map((leg, index) => ({
      from: leg.from,
      to: index === route.length - 1 ? leg.to : route[index + 1].from,
      departure_date: leg.departure_date,
      arrival_date: leg.arrival_date,
      price: leg.price
    })),
    operator: route.map(leg => leg.operator),
    departure_date: firstLeg.departure_date,
    arrival_date: lastLeg.arrival_date,
    price: route.reduce((total, leg) => total + leg.price, 0),
    transfer_count: route.length - 1,
    ticket_ids: route.map(leg => leg.ticket_id)
  };
}


function calculateTotalDuration(tickets) {
  return tickets.reduce((total, ticket) => {
    const firstStop = ticket.stops[0];
    const lastStop = ticket.stops[ticket.stops.length - 1];
    return total + moment(lastStop.arrival_date).diff(moment(firstStop.departure_date), 'minutes');
  }, 0);
}

function calculateTotalPrice(tickets) {
  return tickets.reduce((total, ticket) => total + ticket.price, 0);
}


module.exports = { generateTickets, buildGraph, findConnectedRoutes, formatConnectedRoute, calculateTotalPrice, calculateTotalDuration };