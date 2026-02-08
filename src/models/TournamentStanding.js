const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const TournamentStanding = sequelize.define('TournamentStanding', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stageId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  registrationId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  wins: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  losses: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  draws: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  omw: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  gw: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  ogw: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'standings',
  timestamps: true
});

module.exports = TournamentStanding;

