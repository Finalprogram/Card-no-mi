const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Card = sequelize.define('Card', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  api_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  variant: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  code: {
    type: DataTypes.STRING
  },
  rarity: {
    type: DataTypes.STRING
  },
  type: {
    type: DataTypes.STRING
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cost: {
    type: DataTypes.INTEGER
  },
  power: {
    type: DataTypes.INTEGER
  },
  counter: {
    type: DataTypes.STRING
  },
  color: {
    type: DataTypes.STRING
  },
  family: {
    type: DataTypes.TEXT
  },
  ability: {
    type: DataTypes.TEXT
  },
  trigger: {
    type: DataTypes.TEXT
  },
  game: {
    type: DataTypes.ENUM('onepiece'),
    allowNull: false
  },
  set_name: {
    type: DataTypes.TEXT
  },
  image_url: {
    type: DataTypes.TEXT
  },
  type_line: {
    type: DataTypes.TEXT
  },
  price_trend: {
    type: DataTypes.ENUM('up', 'down', 'stable'),
    defaultValue: 'stable'
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  attribute: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  set: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  notes: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  colors: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  legalities: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'cards',
  timestamps: true
});

Object.defineProperty(Card.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = Card;
