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
  
  // Controle de saldo e repasse
  balanceProcessed: { type: Boolean, default: false },
  includedInPayout: { type: Boolean, default: false },
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' }
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

// Hook para notificar sobre mudança de status e atualizar saldos
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
      const statusTranslations = {
        'PendingPayment': 'Pagamento Pendente',
        'Paid': 'Pago',
        'Processing': 'Em Processamento',
        'Shipped': 'Enviado',
        'Delivered': 'Entregue',
        'Cancelled': 'Cancelado'
      };
      const translatedStatus = statusTranslations[newStatus] || newStatus;

      const subject = `Atualização do Pedido #${orderId}`;
      const htmlContent = `
  <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#222;">
    <p style="text-align:center;"><img src="https://www.cardnomi.com.br/images/Logo.png" alt="CardNoMi Logo" style="max-width: 150px;"></p>
    <p>Olá,</p>
    <p>O status do seu pedido <strong>#${orderId}</strong> foi atualizado para: <strong>${translatedStatus}</strong>.</p>
    <p style="text-align:center; margin:20px 0;">
      <a href="https://www.cardnomi.com.br/pedidos/${orderId}" style="display:inline-block; padding:12px 20px; text-decoration:none; border-radius:6px; border:1px solid #1a73e8; background-color: #1a73e8; color: #ffffff;">
        Ver detalhes do pedido
      </a>
    </p>
    <p>Se tiver dúvidas, responda este e-mail ou acesse nossa Central de Ajuda.</p>
    <p>Abraços,<br/>Equipe Car'D No Mi</p>
  </div>
`;

      for (const email of emailsToNotify) {
        // Não esperamos a conclusão do envio para não bloquear o processo
        sendEmail(email, subject, htmlContent)
          .catch(err => logger.error(`Falha ao enviar e-mail de notificação de status para ${email}`, err));
      }

      // Atualizar saldo dos vendedores quando status mudar
      const { updateSellerBalancesForOrder } = require('../services/balanceService');
      updateSellerBalancesForOrder(this._id.toString())
        .catch(err => logger.error(`Falha ao atualizar saldo para pedido ${orderId}:`, err));

    } catch (error) {
      logger.error(`Erro no hook de notificação de status do pedido ${this._id}:`, error);
      // Não bloqueia a operação de salvar, apenas registra o erro.
    }
  }
  next();
});


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;