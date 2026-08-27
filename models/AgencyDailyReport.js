const mongoose = require("mongoose");

const agencyDailyReportSchema = mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    report_date: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: "Europe/Skopje",
    },
    start_at: Date,
    end_at: Date,
    booking_count: {
      type: Number,
      default: 0,
    },
    passenger_count: {
      type: Number,
      default: 0,
    },
    totals_by_currency: [
      {
        currency: String,
        total: Number,
        booking_count: Number,
        passenger_count: Number,
      },
    ],
    bookings: [
      {
        booking: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
        },
        external_id: String,
        route: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Route",
        },
        ticket: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ticket",
        },
        from_city: String,
        to_city: String,
        departure_date: Date,
        sold_at: Date,
        passenger_count: Number,
        price: Number,
        currency: String,
        passengers: [
          {
            full_name: String,
            phone: String,
            email: String,
            price: Number,
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

agencyDailyReportSchema.index(
  { agency: 1, report_date: 1 },
  { unique: true },
);

module.exports = mongoose.model("AgencyDailyReport", agencyDailyReportSchema);
