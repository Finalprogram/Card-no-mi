const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User');
const Order = require('./Order');

class Payout extends Model {
  static async createFromOrders(sellerId, orderIds, periodStart, periodEnd) {
    const orders = await Order.findAll({ where: { id: orderIds } });
    const seller = await User.findByPk(sellerId);

    if (!seller) {
      throw new Error('Vendedor não encontrado');
    }

    let grossAmount = 0;
    let marketplaceFee = 0;
    const payoutOrders = [];

    for (const order of orders) {
      const sellerItems = order.items.filter(item => item.seller.toString() === sellerId.toString());

      if (sellerItems.length === 0) continue;

      let orderTotal = 0;
      const items = sellerItems.map(item => {
        const itemTotal = item.price * item.quantity;
        const fee = itemTotal * (seller.fee_override_percentage / 100);
        const net = itemTotal - fee;
        orderTotal += net;
        grossAmount += itemTotal;
        marketplaceFee += fee;

        return {
          itemId: item.id,
          cardName: item.cardName,
          quantity: item.quantity,
          price: item.price,
          marketplaceFee: fee,
          sellerNet: net
        };
      });

      payoutOrders.push({
        orderId: order.id,
        items: items,
        orderTotal: orderTotal,
        orderDate: order.createdAt
      });
    }

    const netAmount = grossAmount - marketplaceFee;

    return this.create({
      sellerId: sellerId,
      orders: payoutOrders,
      amount: netAmount,
      breakdown: {
        grossAmount,
        marketplaceFee,
        shippingCost: 0,
        adjustments: 0,
        netAmount
      },
      periodStart,
      periodEnd,
      bankInfo: seller.bankInfo,
      paymentMethod: seller.payoutSettings?.preferredMethod || 'PIX',
      status: 'Pending'
    });
  }
}

Payout.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  orders: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  breakdown: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Scheduled', 'Processing', 'Completed', 'Failed', 'Cancelled', 'OnHold'),
    defaultValue: 'Pending'
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scheduledDate: {
    type: DataTypes.DATE
  },
  processedDate: {
    type: DataTypes.DATE
  },
  completedDate: {
    type: DataTypes.DATE
  },
  bankInfo: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  paymentMethod: {
    type: DataTypes.ENUM('PIX', 'BankTransfer', 'MercadoPago', 'PayPal', 'Manual'),
    allowNull: false
  },
  externalTransactionId: {
    type: DataTypes.STRING
  },
  receipt: {
    type: DataTypes.JSON,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT
  },
  internalNotes: {
    type: DataTypes.TEXT
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notificationSentAt: {
    type: DataTypes.DATE
  },
  statusHistory: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  }
}, {
  sequelize,
  modelName: 'Payout',
  tableName: 'payouts',
  timestamps: true,
  hooks: {
    beforeUpdate: (payout, options) => {
      if (payout.changed('status')) {
        payout.statusHistory.push({
          status: payout.status,
          changedAt: new Date(),
          changedBy: options.userId, // Assuming userId is passed in options
          reason: options.reason || null
        });

        if (payout.status === 'Processing') {
          payout.processedDate = new Date();
        } else if (payout.status === 'Completed') {
          payout.completedDate = new Date();
        }
      }
    }
  }
});

Payout.belongsTo(User, { as: 'seller', foreignKey: 'sellerId' });

module.exports = Payout;
