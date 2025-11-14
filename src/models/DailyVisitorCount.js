const mongoose = require('mongoose');

const DailyVisitorCountSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    // Ensure date is stored at the beginning of the day for consistent daily tracking
    set: function(date) {
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
  },
  count: {
    type: Number,
    required: true,
    default: 0
  }
});

// Add an index to the date field for faster queries
DailyVisitorCountSchema.index({ date: 1 });

module.exports = mongoose.model('DailyVisitorCount', DailyVisitorCountSchema);
