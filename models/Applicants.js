const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  contact_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'is invalid']
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  fleet_size: {
    type: Number,
    default: 0
  },
  routes: {
    type: String,
    trim: true
  },
  experience: {
    type: Number,
    default: 0
  },
  additional_info: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    required: true,
  },
  tax_number: {
    type: String,
    required: true,
    trim: true
  },
  registration_number: {
    type: String,
    required: true,
    trim: true
  },
  is_confirmed: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Applicant', applicantSchema);
