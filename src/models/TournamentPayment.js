const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const TournamentPayment = sequelize.define('TournamentPayment', {
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
    type: DataTypes.INTEGER,
    allowNull: false
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'WAITING_PAYMENT',
    validate: { isIn: [['WAITING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']] }
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PIX',
    validate: { isIn: [['PIX', 'CARD', 'BALANCE']] }
  },
  providerChargeId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  amountCents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'payments',
  timestamps: true
});

module.exports = TournamentPayment;

