const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxLength: 1000
  }
},{timestamps:true});

reviewSchema.index({ operator: 1 });
reviewSchema.index({ user: 1 });

module.exports = mongoose.model('Review', reviewSchema);
