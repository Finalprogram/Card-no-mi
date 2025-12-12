const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  totals: {
    type: DataTypes.JSON,
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PendingPayment', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'),
    allowNull: false,
    defaultValue: 'PendingPayment'
  },
  trackingCode: {
    type: DataTypes.STRING
  },
  melhorEnvioShipmentId: {
    type: DataTypes.STRING
  },
  melhorEnvioLabelUrl: {
    type: DataTypes.STRING
  },
  melhorEnvioTrackingUrl: {
    type: DataTypes.STRING
  },
  melhorEnvioService: {
    type: DataTypes.STRING
  },
  shippingSelections: {
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
  tableName: 'orders',
  timestamps: true
});

module.exports = Order;