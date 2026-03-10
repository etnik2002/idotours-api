const mongoose = require("mongoose");

const ticketSchema = mongoose.Schema({
  route_number: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  destination: {
    from: {
      type: String,
    },
    to: {
      type: String,
    },
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Operator",
  },
  stops: [
    {
      from:
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Station",
      },
      to:
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Station",
      },
      time: { type: String },
      departure_date: { type: Date },
      price: { type: Number },
      children_price: { type: Number },
      max_buying_time: { type: String },
      arrival_time: { type: Date },
      days_of_week: {
        type: [String],
      },
      other_prices: {
        our_price: {
          type: Number,
        },
        our_children_price: {
          type: Number,
        },
        return_price: {
          type: Number,
        },

      },
      views: {
        type: Number,
      },
    }
  ],
  departure_date: {
    type: Date,
  },
  time: {
    type: String,
  },
  type: {
    type: String,
    enum: ["one_way", "return"],
    default: "return",
  },
  number_of_tickets: {
    type: Number,
    default: 48,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  location: {
    from: {
      lat: { type: Number },
      lng: { type: Number }
    },
    to: {
      lat: { type: Number },
      lng: { type: Number }
    },
  },
  metadata: {
    operator_name: {
      type: String,
    },
    operator_company_name: {
      type: String,
    },
    message: {
      type: String,
    },
    features: {
      type: [String],
    },
    views: {
      type: Number,
    },
    is_single_ticket: {
      type: Boolean,
      default: false,
    },

  },
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
