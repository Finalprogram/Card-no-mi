const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const TournamentParticipant = sequelize.define('TournamentParticipant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  displayName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('registered', 'checked_in', 'dropped'),
    allowNull: false,
    defaultValue: 'registered'
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
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'tournament_participants',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['tournamentId', 'userId']
    }
  ]
});

Object.defineProperty(TournamentParticipant.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = TournamentParticipant;

