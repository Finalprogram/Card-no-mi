const DailyVisitorCount = require('../models/DailyVisitorCount');

// In-memory set to track unique session IDs for the current day
// This prevents multiple increments for the same session within a day
const dailyUniqueSessions = new Set();
let lastResetDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// Function to reset the daily unique sessions at the start of a new day
function resetDailyTracker() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    dailyUniqueSessions.clear();
    lastResetDate = today;
  }
}

// Middleware to track unique visitors
const visitorTracker = async (req, res, next) => {
  resetDailyTracker(); // Check and reset daily tracker if a new day has started

  // Only track if a session exists and it's not an admin page (to avoid skewing general traffic)
  // You might want to adjust this logic based on what constitutes a "visitor" for your analytics
  if (req.sessionID && !req.originalUrl.startsWith('/admin')) {
    const sessionId = req.sessionID;

    if (!dailyUniqueSessions.has(sessionId)) {
      dailyUniqueSessions.add(sessionId);

      try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Normalize to start of the day UTC

        await DailyVisitorCount.findOneAndUpdate(
          { date: today },
          { $inc: { count: 1 } },
          { upsert: true, new: true } // Create if not exists, return new document
        );
      } catch (error) {
        console.error('Error updating daily unique visitor count:', error);
        // Continue without blocking the request even if update fails
      }
    }
  }
  next();
};

module.exports = visitorTracker;
