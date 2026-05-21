const mongoose = require("mongoose");

const pendingPaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      default: "Halkbank",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "807",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "approved", "failed"],
      default: "pending",
      index: true,
    },
    bookingRequests: [
      {
        operatorId: String,
        userId: String,
        ticketId: String,
        body: mongoose.Schema.Types.Mixed,
      },
    ],
    bookingSummaries: [mongoose.Schema.Types.Mixed],
    createdBookingIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    bankResponse: mongoose.Schema.Types.Mixed,
    failureMessage: String,
    processedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("PendingPayment", pendingPaymentSchema);
