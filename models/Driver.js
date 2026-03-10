const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const driverSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Operator',
    },
    assigned_routes: [
      {
        route: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Route',
        },
        label: String,
      },
    ],
    scanned_bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
  });

  driverSchema.methods.generateAuthToken = function (data) {
      data.password = undefined;
      const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '7d',
      });

      return token;
  };


module.exports = mongoose.model("Driver", driverSchema);