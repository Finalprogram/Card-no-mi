const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Deck = sequelize.define('Deck', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  leader: {
    type: DataTypes.JSON,
    allowNull: true
  },
  main: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'decks',
  timestamps: true
});

module.exports = Deck;
