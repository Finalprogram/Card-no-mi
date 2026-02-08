const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const DecklistSnapshot = sequelize.define('DecklistSnapshot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  registrationId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  leaderCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mainDeck: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  donDeck: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'decklist_snapshots',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['tournamentId', 'playerId']
    }
  ]
});

module.exports = DecklistSnapshot;

