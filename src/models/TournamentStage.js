const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const TournamentStage = sequelize.define('TournamentStage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['SWISS', 'TOP_CUT', 'LEAGUE', 'ROUND_ROBIN', 'CUSTOM']] }
  },
  settings: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING'
  }
}, {
  tableName: 'stages',
  timestamps: true
});

module.exports = TournamentStage;

