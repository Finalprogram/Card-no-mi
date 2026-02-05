const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const TournamentMatch = sequelize.define('TournamentMatch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tableNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerAId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerBId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  winnerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isDraw: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed'),
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  tableName: 'tournament_matches',
  timestamps: true
});

Object.defineProperty(TournamentMatch.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = TournamentMatch;

