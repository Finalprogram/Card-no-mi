const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const Card = require('./Card');

const PriceHistory = sequelize.define('PriceHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cardId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cards',
      key: 'id'
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'price_histories',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['cardId', 'date'] }
  ]
});

PriceHistory.belongsTo(Card, { as: 'card', foreignKey: 'cardId' });

module.exports = PriceHistory;
