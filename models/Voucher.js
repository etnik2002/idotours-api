const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR'], 
  },
  total_quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  claimed_quantity: {
    type: Number,
    default: 0,
  },
  expiration_date: {
    type: Date,
    required: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  claimed_by: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  use_as_coupon_code: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true
});

voucherSchema.virtual('is_available').get(function() {
  return this.is_active && 
         this.claimed_quantity < this.total_quantity && 
         new Date() < this.expiration_date;
});

voucherSchema.methods.claim = async function(userId) {
  if (!this.is_active) {
    throw new Error('This voucher is no longer available');
  }

  if (this.claimed_by.includes(userId)) {
    throw new Error('You have already claimed this voucher');
  }

  this.claimed_quantity += 1;
  this.claimed_by.push(userId);

  if (this.claimed_quantity >= this.total_quantity) {
    this.is_active = false;
  }

  return this.save();
};


const Voucher = mongoose.model('Voucher', voucherSchema);

module.exports = Voucher;