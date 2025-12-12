const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Achievement = sequelize.define('Achievement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('posts', 'threads', 'reactions', 'faction', 'special', 'trading'),
    allowNull: false
  },
  tier: {
    type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond'),
    defaultValue: 'bronze'
  },
  requirement: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rewardPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isHidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'achievements',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['key'] }
  ]
});

const UserAchievement = sequelize.define('UserAchievement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  achievementId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'achievements',
      key: 'id'
    }
  },
  unlockedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_achievements',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['userId', 'achievementId'], unique: true }
  ]
});

module.exports = { Achievement, UserAchievement };
