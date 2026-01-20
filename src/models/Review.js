const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User'); // Assuming User model is defined in User.js
const Order = require('./Order'); // Assuming Order model is defined in Order.js

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: { // Changed from 'order' to 'orderId' for Sequelize convention
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Orders', // Assuming 'Orders' is the table name for the Order model
      key: 'id'
    }
  },
  orderItemId: {
    type: DataTypes.INTEGER, // Assuming orderItemId will be an integer ID
    allowNull: false,
  },
  sellerId: { // Changed from 'seller' to 'sellerId' for Sequelize convention
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // Assuming 'Users' is the table name for the User model
      key: 'id'
    }
  },
  buyerId: { // Changed from 'buyer' to 'buyerId' for Sequelize convention
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // Assuming 'Users' is the table name for the User model
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
    type: DataTypes.STRING,
  },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['orderId', 'orderItemId', 'buyerId']
    }
  ]
});

// Define associations
Review.belongsTo(Order, { foreignKey: 'orderId' });
Review.belongsTo(User, { as: 'seller', foreignKey: 'sellerId' });
Review.belongsTo(User, { as: 'buyer', foreignKey: 'buyerId' });

module.exports = Review;
