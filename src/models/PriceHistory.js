const mongoose = require('mongoose');

const PriceHistorySchema = new mongoose.Schema({
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// To improve query performance for a specific card's history
PriceHistorySchema.index({ card: 1, date: -1 });

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);