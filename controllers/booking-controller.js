require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { server_error, error_404, ok, bad_request, unauthorized } = require("../functions/responses");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Operator = require("../models/Operator");
const Ticket = require("../models/Ticket");
const Driver = require("../models/Driver");
const mongoose = require("mongoose");
const { NotificationTypes, EnvTypes, PlatformTypes } = require('../helpers/types');
const { calculateFlexDates } = require("../functions/booking");
const { sendBookingConfirmationEmail, sendBookingReceiptEmail, sendBookingConfirmationEmailWithAttachment, sendOperatorBookingNotification } = require("../helpers/email");
const User = require("../models/User");
const Agency = require("../models/Agency");
const moment = require("moment-timezone");
const { generateETicket, generateSingleETicket } = require("../helpers/pdf");

const arrayBufferToBuffer = (arrayBuffer) => Buffer.from(new Uint8Array(arrayBuffer));

module.exports = {

  create: async (req, res) => {
    try {
      if (!req.body.payment_intent_id || req.body.payment_intent_id == "") {
        return res.status(401).json({ message: "No payment intent id in request body. Please try again.", data: null })
      }
      console.log({ body: req.body });


      const operator = await Operator.findById(req.params.operator_id).select("notification_permissions company_metadata name email");
      const total_passengers = req.body.passengers;
      console.log({ operator });

      if (total_passengers.length < 1) {
        return bad_request(res, "Number of passengers should be at least one");
      }

      const ticket = await Ticket.findById(req.params.ticket_id).populate("route_number");
      console.log({ ticket });

      if (total_passengers.length > ticket.number_of_tickets) {
        bad_request(res, "Not enough seats left for the requested number of passengers");
      }

      const user_id = req.params.user_id;

      let user_object_id;
      let query;

      try {
        user_object_id = new mongoose.Types.ObjectId(user_id);
        query = { _id: req.params.user_id }
      } catch (error) {
        user_object_id = req.params.user_id;
        query = { appwrite_id: req.params.user_id }
      }

      if (req.body.is_using_deposited_money) {
        deposit_spent = Number(req.body.deposit_spent) || 0;
        const updated = await User.findOneAndUpdate(query, { $inc: { balance_in_cents: -deposit_spent } })
      }


      const { can_cancel_until, can_edit_until } = calculateFlexDates(req.body.stop?.departure_date, req.body.travel_flex);

      let affiliate_acc;
      if (req.body.affiliate_code) {
        affiliate_acc = await Affiliate.findOne({ code: req.body.affiliate_code }).select("code");
      }

      const newBooking = new Booking({
        user: mongoose.Types.ObjectId.isValid(user_id) ? user_object_id : undefined,
        appwrite_user_id: mongoose.Types.ObjectId.isValid(user_id) ? undefined : user_object_id,
        ticket: req.params.ticket_id,
        operator: operator,
        affiliate: new mongoose.Types.ObjectId(affiliate_acc?._id) || null,
        route: new mongoose.Types.ObjectId(ticket.route_number._id),
        departure_date: req.body.stop?.departure_date || null,
        destinations: {
          departure_station: req.body.departure_station,
          arrival_station: req.body.arrival_station,
          departure_station_label: req.body.departure_station_label,
          arrival_station_label: req.body.arrival_station_label,
        },
        labels: {
          from_city: req.body.stop.from.city,
          to_city: req.body.stop.to.city,
        },
        price: req.body.total_price,
        service_fee: req.body.total_price - req.body.operator_price,
        passengers: req.body.passengers,
        platform: PlatformTypes.WEB || "",
        is_paid: true,
        live_mode: process.env.ENV_TYPE == EnvTypes.PROD,
        location: req.body.location || null,
        metadata: {
          discount_amount_in_cents: req.body.discount_amount_in_cents,
          discount_codde: req.body.discount_codde,
          payment_intent_id: req.body.payment_intent_id,
          travel_flex: req.body.travel_flex,
          can_cancel_booking_until: can_cancel_until,
          can_edit_booking_until: can_edit_until,
          deposited_money: {
            used: req.body.is_using_deposited_money,
            amount_in_cents: req.body.deposit_spent
          }
        },
      });

      newBooking.save();
      console.log({ newBooking });

      const language = req.body.gobusly_language || "en";
      sendInvoice(req.body.payment_intent_id, newBooking, language, operator);

      ticket.number_of_tickets -= total_passengers.length;
      ticket.save()

      // if (operator?.notification_permissions?.allow_portal_notifications) {
      //   if (ticket?.number_of_tickets <= operator?.notification_permissions?.not_enough_seats + 1) {
      //     const new_notification = new Notification({
      //       type: NotificationTypes.NOT_ENOUGH_SEATS,
      //       message: `Only ${operator?.notification_permissions?.not_enough_seats} seats are left for the route (${ticket?.destination?.from} / ${ticket?.destination?.to}) on ${moment(ticket.departure_date).format('dddd, DD-MM-YYYY')}`,
      //       title: `Route ${ticket?.route_number?.code} - ${operator.notification_permissions.not_enough_seats} seats left.`,
      //       ticket: ticket?._id,
      //       operator: operator?._id,
      //       redirect_url: `${process.env.FRONTEND_URL}/ticket/seats/${ticket._id}`,
      //     });

      //     new_notification.save();
      //   }
      // }

      ok(res, "Booking was successfull", newBooking);
    } catch (error) {
      server_error(res, error.message, null);
    }
  },

  retreiveBookingByIdAndEmail: async (req, res) => {
    try {
      const { booking_id, passenger_email } = req.params;
      let { select } = req.query;

      const booking = await Booking.findOne({ _id: booking_id, 'passengers.email': passenger_email })
        .sort({ createdAt: 'desc' })
        .select(select)

      if (!booking || booking.length === 0) {
        return res.status(404).json({ message: "No booking found", data: null })
      }

      return res.status(200).json({ message: "Booking data", data: booking })
    } catch (error) {
      server_error(res, error.message, null);
    }
  },

  getByOperator: async (req, res) => {
    try {
      const { operator_id } = req.params;
      let { select, populate, page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);
      const skip = (page - 1) * limit;

      const bookings = await Booking.find({ operator: operator_id, "metadata.refund_action.is_refunded": false })
        .populate(populate)
        .sort({ createdAt: 'desc' })
        .select(select)
        .skip(skip)
        .limit(limit);

      if (!bookings || bookings.length === 0) {
        return res.status(404).json({ message: "No booking found", data: null })
      }

      return res.status(200).json({ message: "Booking reports data", data: bookings })
    } catch (error) {
      server_error(res, "", null);
    }
  },

  getByIdOperator: async (req, res) => {
    try {
      const { select, populate } = req.query;
      const { id } = req.params;
      let { page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      if (!id || id == "") return bad_request(res, "Please specify a booking id");
      const booking = await Booking.findById(id).populate({ path: "operator", select: "name" }).skip(skip).limit(limit);
      if (!booking) {
        return error_404(res, "No booking found.", null);
      }

      const charge = await stripe.charges.list({
        limit: 1,
        payment_intent: booking.metadata.payment_intent_id
      });



      const bookingWithCharge = {
        ...booking.toObject(),
        charge: {
          id: charge?.data[0]?.id || "N/A",
          amount: charge.data[0]?.amount || 0,
          amount_captured: charge.data[0]?.amount_captured || 0,
          amount_captbalance_transactionured: charge.data[0]?.balance_transaction || "N/A",
          captured: charge?.data[0]?.captured || false,
          currency: charge?.data[0]?.currency || "EUR",
          outcome: charge?.data[0]?.outcome || {},
          payment_intent: charge?.data[0]?.payment_intent || "full_deposit_payment",
          payment_method: charge?.data[0]?.payment_method || "N/A",
          payment_method_details: charge?.data[0]?.payment_method_details || {},
          receipt_url: charge?.data[0]?.receipt_url || "",
          refunded: charge?.data[0]?.refunded || false
        }
      };

      ok(res, "Booking data - operator", bookingWithCharge);
    } catch (error) {
      server_error(res, "", null);
    }
  },

  getTotalBookingsCountByOperatorId: async (req, res) => {
    try {
      const { operator_id } = req.params;
      const totalCount = await Booking.countDocuments({ operator: operator_id });
      ok(res, "Total count", totalCount)
    } catch (error) {
      server_error(res, "", null);
    }
  },

  upgradeTravelFlex: async (req, res) => {
    try {
      if (!req.body.payment_intent_id || req.body.payment_intent_id === "") {
        unauthorized(res, "Invalid payment_intent_id ", null);
      }
      await Booking.findByIdAndUpdate(req.params.booking_id, { $set: { 'metadata.travel_flex': req.body.travel_flex } })
      ok(res, "Travel flex upgraded", null)
    } catch (error) {
      server_error(res, "", null);
    }
  },

  getByIdClient: async (req, res) => {
    try {
      const select = req.query.select || "";
      const populate = req.query.populate || "";
      const { id } = req.params;
      let { page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;
      let userId = req.params.id;
      let query;

      if (mongoose.Types.ObjectId.isValid(userId)) {
        userId = new mongoose.Types.ObjectId(userId);
        query = { user: userId };
      } else {
        query = { appwrite_user_id: userId };
      }

      const booking = await Booking.find(query).select(select).populate(populate).skip(skip).limit(limit).sort({ createdAt: 'desc' });
      if (!booking) {
        return error_404(res, "No booking found.", null);
      }

      ok(res, "Booking data", booking);
    } catch (error) {
      server_error(res, "", null);
    }
  },

  getByRoute: async (req, res) => {
    try {
      const select = req.query.select || "";
      const { route_number } = req.params;

      if (!route_number || route_number == "") return bad_request(res, "Please specify a route number (id)");

      let { page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      const bookings = await Booking.find({ route: route_number }).select(select).skip(skip).limit(limit);
      if (!bookings) {
        return error_404(res, "No bookings found.", null);
      }

      ok(res, "Bookings data", bookings);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  getByIds: async (req, res) => {
    try {
      const select = req.query.select || "";
      const { ids } = req.params;

      if (!ids || ids == "") return bad_request(res, "Please specify a route number (id)");

      let { page = 1, limit = 10 } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;
      const splited_ids = ids.split(",");

      const bookings = await Booking.find({ _id: { $in: splited_ids } }).select(select).skip(skip).limit(limit);
      if (!bookings) {
        return error_404(res, "No bookings found.", null);
      }

      ok(res, "Bookings data", bookings);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  getByAgencyId: async (req, res) => {
    try {
      let { select, page = 1, limit = 10 } = req.query;
      const { agency_id } = req.params;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      const bookings = await Booking.find({ agency: agency_id }).select(select).skip(skip).limit(limit);
      if (!bookings) {
        return error_404(res, "No bookings found", null);
      }

      ok(res, "Bookings data", bookings);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  getByUserId: async (req, res) => {
    try {
      let { select, page = 1, limit = 10 } = req.query;
      const { user_id } = req.params;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      const bookings = await Booking.find({ user: user_id }).select(select).sort({ createdAt: 'desc' });
      if (!bookings) {
        return error_404(res, "No bookings found", null);
      }

      ok(res, "Bookings data", bookings);
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  downloadEBooking: async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.booking_id).populate({ path: "operator", select: "name" });
      if (!booking) {
        return bad_request(res, "Booking not found", null);
      }

      const ticketUrl = await generateSingleETicket(booking);
      booking.metadata.download_url = ticketUrl.fileUrl;
      await booking.save();

      const pdfBuffer = arrayBufferToBuffer(ticketUrl.retrievedFile);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="ticket.pdf"');

      return res.end(pdfBuffer);
    } catch (error) {
      return server_error(res, error.message || "Internal Server Error", null);
    }
  },

  downloadEBookingMobileAPI: async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.booking_id).populate({ path: "operator", select: "name" });
      console.log({ metadje: booking.metadata });
      if (booking.metadata.download_url) {
        return res.status(200).json({ data: booking.metadata.download_url, message: "Mobile eticket file url" });
      }

      if (!booking) {
        return bad_request(res, "Booking not found", null);
      }

      if (booking.metadata.download_url) {
        return res.status(200).json({ data: ticketUrl.fileUrl, message: "Mobile eticket file url" });
      }

      const ticketUrl = await generateSingleETicket(booking);
      console.log({ ticketUrl });


      const new_booking_metadata = {
        ...booking.metadata,
        download_url: ticketUrl.fileUrl
      }
      await Booking.findByIdAndUpdate(booking._id, { metadata: new_booking_metadata })

      return res.status(200).json({ data: ticketUrl.fileUrl, message: "Mobile eticket file url" });
    } catch (error) {
      console.log({ error });

      return server_error(res, error.message || "Internal Server Error", null);
    }
  },


  editBookingDetails: async (req, res) => {
    try {

    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  cancelBookingAndRefund: async (req, res) => {
    try {
      if (req.body.is_full_deposit_payment) {
        const updated_balance = req.body.balance_in_cents * 0.7;
        await User.findByIdAndUpdate(req.body.user_id, { $inc: { balance_in_cents: updated_balance } });
      }

      const refunded = await Booking.findByIdAndUpdate(req.params.booking_id, { $set: { 'metadata.refund_action.is_refunded': true, 'metadata.refund_action.amount_in_cents': req.body.amount_in_cents } })
      if (!refunded) {
        return res.status(403).json({ message: "Error happened while setting the booking state to refunded, please contact busly support." });
      }

      return res.status(200).json({ message: "Booking refunded successfully.", data: null });
    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  rescheduleBooking: async (req, res) => {
    try {

    } catch (error) {
      server_error(res, error.message || error.response.message, null);
    }
  },

  getAll: async (req, res) => {
    try {
      let { select, page = 1, limit = 10 } = req.query;
      const { user_id } = req.params;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      const bookings = await Booking.find({}).skip(skip).limit(limit).sort({ createdAt: 'desc' }).select(select);
      ok(res, "", bookings)
    } catch (error) {
    }
  },

  scanBoardingPass: async (req, res) => {
    try {
      const driver_id = req.params.driver_id;
      const booking_id = req.params.booking_id;
      const passenger_id = req.params.passenger_id;

      if (!mongoose.Types.ObjectId.isValid(booking_id)) {
        unauthorized(res, "Invalid booking id", null);
      }

      const driver = await Driver.findById(driver_id).select("scanned_bookings assigned_routes").populate('assigned_routes');
      if (!driver) {
        unauthorized("You are not authorized to scan this boarding pass.");
      }

      const booking = await Booking.findById(booking_id).select("is_paid passengers route").populate("route");

      if (!booking) {
        error_404(res, "Booking not found", null);
      }

      if (!booking.is_paid) {
        unauthorized(res, "Booking not paid", null);
      }

      const date_now = moment.utc();
      const booking_date = moment.utc(booking?.departure_date);

      if (date_now.isAfter(booking_date)) {
        unauthorized(res, "Invalid booking date. The departure time does not match the scheduled bus departure.", null);
      }

      const passenger_index = booking.passengers.findIndex(p => p._id.equals(new mongoose.Types.ObjectId(passenger_id)));
      if (passenger_index === -1) {
        error_404(res, "Passenger not found", null);
      }

      const is_scanned = booking.passengers[passenger_index].is_scanned;
      if (is_scanned) {
        bad_request(res, "The passenger has already boarded, and the ticket has already been scanned.", null);
      }

      let is_line_matched = driver?.assigned_routes?.some(line => line._id.equals(booking?.route?._id));
      if (!is_line_matched) {
        bad_request(res, `The route number (${booking?.route?.code}) does not match the driver's route. Please check if you have boarded the correct bus.`, null);
      } else {
        try {
          const has_scanned_this = driver?.scanned_bookings?.some((passenger) => passenger._id.equals(new mongoose.Types.ObjectId(passenger_id)))
          if (!has_scanned_this) {
            await Driver.findByIdAndUpdate(driver_id, { $push: { scanned_bookings: booking.passengers[passenger_index]._id } });
          }

          booking.passengers[passenger_index].is_scanned = true;
          booking.save();
          ok(res, "Boarding successfull", null);
        } catch (error) {
          server_error(res, "", null);
        }
      }
    } catch (error) {
      server_error(res, "", null);
    }
  },

  createManualBooking: async (req, res) => {
    try {
      const operator_id = process.env.HARDCODED_OPERATOR_ID;
      const {
        ticket_id,
        passengers,
        total_price,
        departure_date,
        departure_station,
        arrival_station,
        departure_station_label,
        arrival_station_label,
        from_city,
        to_city,
        is_paid
      } = req.body;

      if (!passengers || passengers.length < 1) {
        return bad_request(res, "Number of passengers should be at least one");
      }

      const ticket = await Ticket.findById(ticket_id).populate("route_number");
      if (!ticket) {
        return error_404(res, "Ticket not found", null);
      }

      const newBooking = new Booking({
        ticket: ticket_id,
        operator: operator_id,
        route: ticket.route_number?._id,
        departure_date: departure_date || ticket.departure_date,
        destinations: {
          departure_station: departure_station,
          arrival_station: arrival_station,
          departure_station_label: departure_station_label,
          arrival_station_label: arrival_station_label,
        },
        labels: {
          from_city: from_city || ticket.destination?.from,
          to_city: to_city || ticket.destination?.to,
        },
        price: total_price,
        service_fee: 0,
        passengers: passengers,
        platform: PlatformTypes.WEB,
        is_paid: is_paid === true || is_paid === 'true' ? 'true' : 'false',
        live_mode: process.env.ENV_TYPE == EnvTypes.PROD,
        metadata: {
          travel_flex: "NO_FLEX",
          message: "Manual booking from dashboard"
        },
      });

      await newBooking.save();

      ticket.number_of_tickets -= passengers.length;
      await ticket.save();

      return ok(res, "Manual booking created successfully", newBooking);
    } catch (error) {
      console.error(error);
      return server_error(res, error.message, null);
    }
  },

  createAgencyBooking: async (req, res) => {
    try {
      const { agency_id, ticket_id } = req.params;
      const { passengers, total_price, stop, departure_station, arrival_station, departure_station_label, arrival_station_label, location } = req.body;

      if (!passengers || passengers.length < 1) {
        return bad_request(res, "Number of passengers should be at least one");
      }

      const [agency, ticket] = await Promise.all([
        Agency.findById(agency_id),
        Ticket.findById(ticket_id).populate("route_number")
      ]);

      if (!agency) return error_404(res, "Agency not found", null);
      if (!ticket) return error_404(res, "Ticket not found", null);

      if (passengers.length > ticket.number_of_tickets) {
        return bad_request(res, "Not enough seats left");
      }

      const operator_id = ticket.operator || process.env.HARDCODED_OPERATOR_ID;

      const newBooking = new Booking({
        agency: agency_id,
        ticket: ticket_id,
        operator: operator_id,
        route: ticket.route_number?._id,
        departure_date: stop?.departure_date || ticket.departure_date,
        destinations: {
          departure_station,
          arrival_station,
          departure_station_label,
          arrival_station_label,
        },
        labels: {
          from_city: stop?.from?.city || ticket.destination?.from,
          to_city: stop?.to?.city || ticket.destination?.to,
        },
        price: total_price,
        service_fee: 0,
        passengers: passengers,
        platform: PlatformTypes.WEB,
        is_paid: true,
        live_mode: process.env.ENV_TYPE == EnvTypes.PROD,
        location: location || null,
        metadata: {
          travel_flex: "NO_FLEX",
          message: "Agency booking"
        },
      });

      await newBooking.save();

      // Update agency financial data
      agency.financial_data.total_sales = (agency.financial_data.total_sales || 0) + total_price;
      const commission = (total_price * (agency.financial_data.percentage || 10)) / 100;
      agency.financial_data.profit = (agency.financial_data.profit || 0) + commission;
      agency.financial_data.debt = (agency.financial_data.debt || 0) + (total_price - commission);
      await agency.save();

      ticket.number_of_tickets -= passengers.length;
      await ticket.save();

      // Send confirmation email
      await sendBookingConfirmationEmailWithAttachment(newBooking, req.body.language || "en");

      return ok(res, "Agency booking created successfully", newBooking);
    } catch (error) {
      console.error(error);
      return server_error(res, error.message, null);
    }
  },

  generateETicketForMobileAPI: async (req, res) => {
    try {
      console.log("|zjarrrr");

      const booking = await Booking.findById(req.params.booking_id).populate('operator');

      await sendBookingConfirmationEmailWithAttachment(booking, req.body.language);

      if (booking.operator) {
        await sendOperatorBookingNotification(booking, booking.operator);
      }

      return res.status(200).json({ data: null, message: "E-Ticket generated successfully" })
    } catch (error) {
      server_error(res, "", null);
    }
  }

}


async function sendInvoice(payment_intent_id, newBooking, language, operator) {
  try {
    const charge = await stripe.charges.list({
      limit: 1,
      payment_intent: payment_intent_id,
    });
    const receipt_url = charge.data[0].receipt_url;

    await sendBookingConfirmationEmailWithAttachment(newBooking, language);

    await sendBookingReceiptEmail(receipt_url, newBooking.passengers[0].email, language);

    if (operator) {
      await sendOperatorBookingNotification(newBooking, operator);
    }
  } catch (error) {
    console.error('Error in sendInvoice:', error);
  }
}

