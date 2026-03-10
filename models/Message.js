const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  content: String,
  timestamp: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Message', MessageSchema);