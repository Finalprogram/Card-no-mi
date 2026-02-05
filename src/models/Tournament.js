const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  scope: {
    type: DataTypes.ENUM('official', 'community'),
    allowNull: false,
    defaultValue: 'community'
  },
  status: {
    type: DataTypes.ENUM('draft', 'open', 'in_progress', 'finished', 'cancelled'),
    allowNull: false,
    defaultValue: 'open'
  },
  format: {
    type: DataTypes.ENUM('swiss', 'single_elimination'),
    allowNull: false,
    defaultValue: 'swiss'
  },
  maxPlayers: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 16
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rules: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bannerUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'tournaments',
  timestamps: true
});

Object.defineProperty(Tournament.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = Tournament;
