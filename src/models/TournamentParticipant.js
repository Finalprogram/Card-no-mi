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
  registrationId: {
    type: DataTypes.STRING,
    allowNull: true
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
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING',
    validate: {
      isIn: [[
        'PENDING',
        'CONFIRMED',
        'WAITING_LIST',
        'CHECKED_IN',
        'CANCELLED',
        'NO_SHOW',
        'DROPPED'
      ]]
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'FREE',
    validate: { isIn: [['FREE', 'PAID']] }
  },
  seatNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  seed: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  checkInAt: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'registrations',
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
