const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User');
const Order = require('./Order');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
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
  buyerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'reviews',
  timestamps: true
});

Review.belongsTo(User, { as: 'seller', foreignKey: 'sellerId' });
Review.belongsTo(User, { as: 'buyer', foreignKey: 'buyerId' });
Review.belongsTo(Order, { as: 'order', foreignKey: 'orderId' });

module.exports = Review;