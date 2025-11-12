const mongoose = require('mongoose');
const { sendEmail } = require('../services/emailService'); // Importar sendEmail
const logger = require('../config/logger');

const addressSchema = new mongoose.Schema({
  cep: { type: String, required: true },
  street: { type: String, required: true },
  number: { type: String, required: true },
  complement: { type: String },
  neighborhood: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
}, { _id: false }); // _id: false para não criar um _id para o subdocumento

const orderItemSchema = new mongoose.Schema({
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    // Not strictly required, as a card might be bought from the system directly
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  // Store some denormalized data to avoid breaking if original card/listing changes
  cardName: String,
  sellerName: String,
  isReviewed: { type: Boolean, default: false },
  marketplaceFee: { type: Number, required: true },
  sellerNet: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totals: {
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    grand: { type: Number, required: true },
    marketplaceFee: { type: Number, required: true },
    sellerNet: { type: Number, required: true }
  },
  shippingAddress: {
    type: addressSchema,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PendingPayment', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'PendingPayment'
  },
  trackingCode: {
    type: String,
  },
  melhorEnvioShipmentId: {
    type: String,
  },
  melhorEnvioLabelUrl: {
    type: String,
  },
  melhorEnvioTrackingUrl: {
    type: String,
  },
  melhorEnvioService: {
    type: String,
  },
  shippingSelections: [
    {
      sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      service: String,
      name: String,
      price: Number,
      deliveryTime: Number,
    },
  ],
}, { timestamps: true });

// Hook para notificar sobre mudança de status
orderSchema.pre('save', async function (next) {
  // `isModified` só está disponível em documentos, não em queries.
  // Este hook é para `document.save()`, que é o caso de uso aqui.
  if (this.isModified('status')) {
    try {
      // Popula as referências para obter os documentos completos do comprador e vendedores
      await this.populate('user');
      await this.populate('items.seller');

      const buyer = this.user;
      const newStatus = this.status;
      const orderId = this._id;

      // Coleta de e-mails
      const emailsToNotify = new Set();
      if (buyer && buyer.email) {
        emailsToNotify.add(buyer.email);
      }

      this.items.forEach(item => {
        if (item.seller && item.seller.email) {
          emailsToNotify.add(item.seller.email);
        }
      });

      // Envio de e-mails
      const subject = `Atualização do Pedido #${orderId}`;
      const htmlContent = `<p>Olá,</p><p>O status do seu pedido #${orderId} foi atualizado para: <strong>${newStatus}</strong>.</p><p>Acesse o site para mais detalhes.</p>`;

      for (const email of emailsToNotify) {
        // Não esperamos a conclusão do envio para não bloquear o processo
        sendEmail(email, subject, htmlContent)
          .catch(err => logger.error(`Falha ao enviar e-mail de notificação de status para ${email}`, err));
      }

    } catch (error) {
      logger.error(`Erro no hook de notificação de status do pedido ${this._id}:`, error);
      // Não bloqueia a operação de salvar, apenas registra o erro.
    }
  }
  next();
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;