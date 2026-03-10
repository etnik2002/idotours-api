const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  contractId: {
    type: String,
    unique: true,
    required: true,
    default: () => require('uuid').v4()
  },
  
  operatorName: {
    type: String,
    required: true
  },
  operatorEmail: {
    type: String,
    required: true
  },
  operatorAddress: {
    type: String,
    required: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  operatorPhone: {
    type: String,
    required: true
  },
  
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  status: {
    type: String,
    enum: ['draft', 'sent', 'signed', 'completed'],
    default: 'draft'
  },
  
  signed: {
    type: Boolean,
    default: false
  },
  signatureData: {
    type: String,
    default: null
  },
  signerIP: {
    type: String,
    default: null
  },
  signedAt: {
    type: Date,
    default: null
  },
  
  contractHTML: {
    type: String,
    required: true
  },
  contractPDF: {
    type: String,
    default: null
  },
  
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  
  signingToken: {
    type: String,
    unique: true,
    default: () => require('uuid').v4()
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contract', contractSchema);
