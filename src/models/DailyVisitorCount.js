const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const DailyVisitorCount = sequelize.define('DailyVisitorCount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'daily_visitor_counts',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['date'] }
  ]
});

module.exports = DailyVisitorCount;
