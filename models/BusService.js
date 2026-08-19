const mongoose = require("mongoose");

const busServiceSchema = mongoose.Schema(
  {
    operator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      required: true,
      index: true,
    },
    bus_plates: {
      type: String,
      required: true,
      trim: true,
    },
    bus_serial: {
      type: String,
      trim: true,
    },
    service_date: {
      type: String,
      required: true,
    },
    odometer_km: Number,
    workshop: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    cost: Number,
    next_service_date: String,
    file_url: String,
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BusService", busServiceSchema);
