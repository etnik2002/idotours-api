const mongoose = require('mongoose');

const AbandonedCheckoutSchema = new mongoose.Schema({
  checkoutId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  selectedTicket: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  outboundTicket: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  returnTicket: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  passengers: [{
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    birthdate: String,
    age: Number,
    price: Number,
    luggages_price: Number,
    total_luggages: Number
  }],
  selectedFlex: {
    type: String,
    enum: ['premium', 'basic', 'no_flex'],
    default: null
  },
  flexPrice: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  resumed: {
    type: Boolean,
    default: false
  },
  resumedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

AbandonedCheckoutSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('AbandonedCheckout', AbandonedCheckoutSchema);