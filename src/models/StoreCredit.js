const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const StoreCredit = sequelize.define('StoreCredit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  storeId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  amountCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'REDEEMED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'AVAILABLE'
  },
  grantedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  redeemedAt: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'store_credits',
  timestamps: true
});

module.exports = StoreCredit;
