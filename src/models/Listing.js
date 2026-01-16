const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Listing = sequelize.define('Listing', {
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
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  condition: {
    type: DataTypes.ENUM('NM', 'LP', 'MP', 'HP'),
    defaultValue: 'NM'
  },
  is_foil: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'EN',
    allowNull: false
  },
  extras: {
    type: DataTypes.JSON,
    defaultValue: []
  }
});

module.exports = Listing;