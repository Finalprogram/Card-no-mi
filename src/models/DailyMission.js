const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const DailyMission = sequelize.define('DailyMission', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'fa-trophy'
  },
  type: {
    type: DataTypes.ENUM('create_thread', 'create_post', 'give_reaction', 'receive_reaction', 'upvote', 'login'),
    allowNull: false
  },
  requirement: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rewardPoints: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'daily_missions',
  timestamps: true,
  updatedAt: false
});

const UserDailyProgress = sequelize.define('UserDailyProgress', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  missions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  totalPointsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_daily_progresses',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['userId', 'date'], unique: true }
  ]
});

module.exports = { DailyMission, UserDailyProgress };
