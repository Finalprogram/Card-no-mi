const mongoose = require('mongoose');

/**
 * Schema de Repasse (Payout) para vendedores
 * Gerencia os pagamentos que o marketplace deve fazer aos vendedores
 */
const payoutSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Referências aos pedidos incluídos neste repasse
  orders: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    // Items específicos deste vendedor no pedido
    items: [{
      itemId: mongoose.Schema.Types.ObjectId,
      cardName: String,
      quantity: Number,
      price: Number,
      marketplaceFee: Number,
      sellerNet: Number
    }],
    orderTotal: Number, // Total deste vendedor neste pedido
    orderDate: Date
  }],

  // Valores do repasse
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Detalhamento financeiro
  breakdown: {
    grossAmount: Number,      // Valor bruto das vendas
    marketplaceFee: Number,   // Taxa retida pelo marketplace
    shippingCost: Number,     // Custo de envio (se aplicável)
    adjustments: Number,      // Ajustes (devoluções, chargebacks, etc)
    netAmount: Number         // Valor líquido a pagar
  },

  // Status do repasse
  status: {
    type: String,
    enum: [
      'Pending',           // Aguardando processamento
      'Scheduled',         // Agendado para pagamento
      'Processing',        // Em processamento
      'Completed',         // Pago com sucesso
      'Failed',            // Falha no pagamento
      'Cancelled',         // Cancelado
      'OnHold'            // Retido (problemas com vendedor)
    ],
    default: 'Pending',
    index: true
  },

  // Período coberto por este repasse
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },

  // Datas importantes
  scheduledDate: Date,      // Data agendada para pagamento
  processedDate: Date,      // Data em que foi processado
  completedDate: Date,      // Data em que foi concluído

  // Informações bancárias (snapshot no momento do repasse)
  bankInfo: {
    bankName: String,
    accountType: String,     // 'checking' ou 'savings'
    accountNumber: String,
    routingNumber: String,
    pixKey: String,          // Para pagamentos via PIX
    pixKeyType: String       // 'cpf', 'email', 'phone', 'random'
  },

  // Método de pagamento usado
  paymentMethod: {
    type: String,
    enum: ['PIX', 'BankTransfer', 'MercadoPago', 'PayPal', 'Manual'],
    required: true
  },

  // ID da transação externa (se aplicável)
  externalTransactionId: String,

  // Comprovante de pagamento
  receipt: {
    url: String,
    uploadedAt: Date
  },

  // Notas e observações
  notes: String,
  internalNotes: String,    // Notas internas (não visível ao vendedor)

  // Notificações
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date,

  // Histórico de mudanças de status
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }]

}, { 
  timestamps: true 
});

// Índices compostos para queries comuns
payoutSchema.index({ seller: 1, status: 1 });
payoutSchema.index({ seller: 1, createdAt: -1 });
payoutSchema.index({ status: 1, scheduledDate: 1 });

// Método para calcular o total a partir dos pedidos
payoutSchema.methods.calculateTotal = function() {
  let total = 0;
  this.orders.forEach(order => {
    total += order.orderTotal;
  });
  return total;
};

// Hook para adicionar entrada no histórico ao mudar status
payoutSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.lastModifiedBy // Você precisará passar isso no update
    });

    // Atualizar datas baseado no status
    if (this.status === 'Processing') {
      this.processedDate = new Date();
    } else if (this.status === 'Completed') {
      this.completedDate = new Date();
    }
  }
  next();
});

// Método estático para criar um repasse a partir de pedidos
payoutSchema.statics.createFromOrders = async function(sellerId, orderIds, periodStart, periodEnd) {
  const Order = mongoose.model('Order');
  const User = mongoose.model('User');
  
  const orders = await Order.find({ _id: { $in: orderIds } }).populate('items.seller');
  const seller = await User.findById(sellerId);
  
  if (!seller) {
    throw new Error('Vendedor não encontrado');
  }

  let grossAmount = 0;
  let marketplaceFee = 0;
  const payoutOrders = [];

  // Processar cada pedido
  for (const order of orders) {
    const sellerItems = order.items.filter(item => 
      item.seller._id.toString() === sellerId.toString()
    );

    if (sellerItems.length === 0) continue;

    let orderTotal = 0;
    const items = sellerItems.map(item => {
      orderTotal += item.sellerNet;
      grossAmount += item.price * item.quantity;
      marketplaceFee += item.marketplaceFee;

      return {
        itemId: item._id,
        cardName: item.cardName,
        quantity: item.quantity,
        price: item.price,
        marketplaceFee: item.marketplaceFee,
        sellerNet: item.sellerNet
      };
    });

    payoutOrders.push({
      orderId: order._id,
      items: items,
      orderTotal: orderTotal,
      orderDate: order.createdAt
    });
  }

  const netAmount = grossAmount - marketplaceFee;

  return new this({
    seller: sellerId,
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
    bankInfo: {
      pixKey: seller.pixKey,
      pixKeyType: seller.pixKeyType,
      bankName: seller.bankName,
      accountType: seller.accountType,
      accountNumber: seller.accountNumber
    },
    paymentMethod: seller.preferredPaymentMethod || 'PIX',
    status: 'Pending'
  });
};

const Payout = mongoose.model('Payout', payoutSchema);

module.exports = Payout;
