const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['posts', 'threads', 'reactions', 'faction', 'special', 'trading'],
    required: true
  },
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze'
  },
  requirement: {
    type: Number,
    required: true
  },
  rewardPoints: {
    type: Number,
    default: 0
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
});

const UserAchievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  achievement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 0
  }
});

UserAchievementSchema.index({ user: 1, achievement: 1 }, { unique: true });

const Achievement = mongoose.model('Achievement', AchievementSchema);
const UserAchievement = mongoose.model('UserAchievement', UserAchievementSchema);

module.exports = { Achievement, UserAchievement };
