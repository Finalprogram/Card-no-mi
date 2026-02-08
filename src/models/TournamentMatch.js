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
  stageId: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  winnerRegistrationId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  winnerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scoreA: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  scoreB: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resultStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING',
    validate: { isIn: [['PENDING', 'REPORTED', 'CONFIRMED', 'DISPUTED', 'VOID']] }
  },
  resultReportedByRegistrationId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resultReportedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resultReportedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resultConfirmedByRegistrationId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resultConfirmedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resultConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isDraw: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  finishedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  updatedByStaffId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'matches',
  timestamps: true
});

Object.defineProperty(TournamentMatch.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = TournamentMatch;
