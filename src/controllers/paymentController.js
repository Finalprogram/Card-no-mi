// src/controllers/paymentController.js

const Order = require('../models/Order');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const logger = require('../config/logger');
const { cotarFreteMelhorEnvio, addItemToCart, purchaseShipments, printLabels } = require('../services/melhorEnvioClient');
const { estimatePackageDims } = require('../services/packaging');
const { addPostPaymentJob } = require('../services/postPaymentQueue');

// Helper function to get seller's origin CEP
async function getSellerOriginCep(sellerId) {
  const globalCepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (sellerId === 'sem-vendedor') return globalCepOrigem;

  const seller = await User.findById(sellerId);
  if (seller && seller.address && seller.address.cep) {
    return seller.address.cep;
  }
  logger.warn(`[payment] Vendedor ${sellerId} sem CEP definido. Usando CEP global.`);
  return globalCepOrigem;
}

// Configura as credenciais do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN, options: { timeout: 5000 } });
const paymentClient = new Payment(client);
logger.info('[payment] Mercado Pago Access Token sendo usado (parcial): ', process.env.MERCADO_PAGO_ACCESS_TOKEN ? process.env.MERCADO_PAGO_ACCESS_TOKEN.substring(0, 10) + '...' : 'Não definido');
const preference = new Preference(client);

/** GET /payment */
function showPayment(req, res) {
  res.render('pages/payment');
}



async function createMercadoPagoPreference(req, res) {
  try {
    const cart = req.session.cart;
    const totals = req.session.totals;
    const userId = req.session.user.id;

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ message: 'Carrinho vazio ou inválido.' });
    }

    // Fetch the user to get payer details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // 1. Validação Primeiro
    if (!user.documentNumber) {
      return res.status(400).json({ message: 'CPF/CNPJ do usuário é obrigatório para o pagamento.' });
    }
    if (!user.phone) {
      return res.status(400).json({ message: 'Telefone do usuário é obrigatório para o pagamento.' });
    }
    if (!req.session.shippingAddress) {
      logger.error('Endereço de entrega não encontrado na sessão ao criar preferência de MP.');
      return res.status(400).json({ message: 'Endereço de entrega é obrigatório.' });
    }

    // 3. Endereço Estruturado
    const shippingAddress = req.session.shippingAddress;
    const shippingSelections = req.session.shippingSelections || [];

    const orderItems = cart.items.map(item => ({
      card: item.cardId,
      listing: item.listingId, // Assumindo que você tenha listingId no carrinho
      seller: item.vendorId,
      quantity: item.qty,
      price: item.price,
      cardName: item.meta.cardName,
      sellerName: item.meta.sellerName,
      marketplaceFee: item.marketplaceFee,
      sellerNet: item.sellerNet,
    }));

    // Cria o pedido no banco de dados com status 'PendingPayment'
    const newOrder = new Order({
      user: userId,
      items: orderItems,
      totals: totals,
      shippingAddress: shippingAddress,
      shippingSelections: shippingSelections, // Store shipping selections
      status: 'PendingPayment', 
    });

    await newOrder.save();
    logger.info(`[Order Creation] Order #${newOrder._id} created for user ${userId} with total ${totals.grand}. Status: PendingPayment.`);

    const items = cart.items.map(item => ({
      title: item.meta.cardName,
      unit_price: Number(item.price),
      quantity: Number(item.qty),
    }));

    const baseUrl = process.env.BASE_URL.replace(/\/$/, '');

    // 5. Formate o CEP
    const formattedPostalCode = shippingAddress.cep.replace('-', '');

    const preferenceBody = {
      items,
      external_reference: newOrder._id.toString(),
      back_urls: {
        success: `${baseUrl}/payment/mercadopago/success`,
        pending: `${baseUrl}/payment/mercadopago/pending`,
        failure: `${baseUrl}/payment/mercadopago/failure`,
      },
      notification_url: `${baseUrl}/payment/mercadopago/webhook`,
      payer: {
        name: user.fullName || user.username,
        surname: '', // Assumindo que não tem sobrenome
        email: user.email,
        phone: {
          area_code: user.phone.substring(0, 2),
          number: user.phone.substring(2),
        },
        address: {
          zip_code: formattedPostalCode,
          street_name: shippingAddress.street,
          street_number: shippingAddress.number,
          neighborhood: shippingAddress.neighborhood,
          city: shippingAddress.city,
          state: shippingAddress.state,
        },
        identification: {
          type: user.documentType || 'CPF',
          number: user.documentNumber,
        },
      },
      shipments: {
        cost: totals.shipping,
        mode: 'not_specified',
        receiver_address: {
          apartment: '',
          city: shippingAddress.city,
          floor: '',
          neighborhood: shippingAddress.neighborhood,
          state: shippingAddress.state,
          street_name: shippingAddress.street,
          street_number: shippingAddress.number,
          zip_code: formattedPostalCode,
        },
      },
      binary_mode: true,
      payment_methods: {
        installments: 1,
        default_installments: 1
      }
    };

    const response = await preference.create({ body: preferenceBody });
    logger.info('[payment] preferenceBody enviado:', preferenceBody);

    // Limpa o carrinho da sessão após a criação da preferência
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
    // Clear shipping info from session as it's now in the order
    delete req.session.shippingAddress;
    delete req.session.shippingSelections;

    res.json({ init_point: response.init_point, orderId: newOrder._id });

  } catch (error) {
    // Log de erro melhorado para capturar o objeto completo
    logger.error("Erro ao criar preferência do Mercado Pago:", error);
    res.status(500).json({ message: "Erro ao criar preferência de pagamento." });
  }
}

async function handleMercadoPagoSuccess(req, res) {
  const { status, external_reference } = req.query;
  logger.info("Mercado Pago Success Redirect:", req.query);

  try {
    let order = null;
    if (external_reference) {
      order = await Order.findById(external_reference);
      // We don't change the status here. The webhook is the source of truth.
      // We just need the order to display totals on the success page.
    }

    // Clear the user's cart as the order has been created
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };

    // The message should indicate that the payment is being processed.
    // The final confirmation will come via the webhook.
    res.render('pages/checkout-success', {
      message: "Pagamento recebido! Estamos processando seu pedido.",
      paymentStatus: status, // 'approved'
      totals: order ? order.totals : null
    });
  } catch (error) {
    logger.error('Erro ao processar retorno de sucesso do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status, totals: null });
  }
}

async function handleMercadoPagoPending(req, res) {
  const { status, external_reference } = req.query;
  logger.info("Mercado Pago Pending Redirect:", req.query);

  try {
    let order = null;
    if (external_reference) {
      order = await Order.findById(external_reference);
      // We DO NOT change the status here. The webhook is the source of truth.
      // This handler is purely for user feedback on redirect.
    }
    res.render('pages/checkout-success', {
      message: "Seu pagamento está pendente. Você receberá a confirmação em breve.",
      paymentStatus: status, // 'pending'
      totals: order ? order.totals : null
    });
  } catch (error) {
    logger.error('Erro ao processar retorno pendente do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status, totals: null });
  }
}

async function handleMercadoPagoFailure(req, res) {
  const { status, external_reference } = req.query;
  logger.info("Mercado Pago Failure Redirect:", req.query);

  try {
    let order = null;
    if (external_reference) {
      order = await Order.findById(external_reference);
      // We DO NOT change the status here. The webhook is the source of truth.
    }
    res.render('pages/checkout-success', {
      message: "O pagamento falhou. Por favor, tente novamente.",
      paymentStatus: status, // 'failure' or 'rejected'
      totals: order ? order.totals : null
    });
  } catch (error) {
    logger.error('Erro ao processar retorno de falha do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status, totals: null });
  }
}
async function handleMercadoPagoWebhook(req, res) {
  logger.info('Webhook Mercado Pago recebido:', req.query, req.body);

  try {
    const { body } = req;

    // Novo formato de webhook (a partir de 2023)
    if (body.action && body.data && body.data.id) {
      const paymentId = body.data.id;
      const payment = await paymentClient.get({ id: paymentId });
      logger.info('Detalhes do pagamento do Mercado Pago (via body):', payment);
      const { status, external_reference } = payment;

      if (!external_reference) {
        logger.error('Webhook Mercado Pago: external_reference ausente no pagamento.', payment);
        return res.status(400).send('external_reference ausente.');
      }

      await processWebhookLogic(status, external_reference, res);

    } else if (body.topic === 'merchant_order' || req.query.topic === 'merchant_order') {
      logger.info(`Webhook Mercado Pago: Tópico merchant_order recebido, ignorando por enquanto.`);
      return res.status(200).send('OK');

    } else if (body.topic === 'payment' || req.query.topic === 'payment') {
      const paymentId = body.id || req.query.id;
      if (!paymentId) {
        logger.warn('Webhook Mercado Pago: ID do pagamento não determinado para o tópico payment.');
        return res.status(400).send('ID do pagamento não determinado.');
      }
      const payment = await paymentClient.get({ id: Number(paymentId) });
      logger.info('Detalhes do pagamento do Mercado Pago (via topic):', payment);
      const { status, external_reference } = payment;

      if (!external_reference) {
        logger.error('Webhook Mercado Pago: external_reference ausente no pagamento.', payment);
        return res.status(400).send('external_reference ausente.');
      }

      await processWebhookLogic(status, external_reference, res);

    } else {
      logger.warn('Webhook Mercado Pago: Formato de webhook não reconhecido ou informações ausentes.', { query: req.query, body: req.body });
      return res.status(400).send('Formato de webhook não reconhecido.');
    }

  } catch (error) {
    logger.error('Erro no webhook do Mercado Pago:', error);
    res.status(500).send('Erro interno do servidor.');
  }
}

async function processWebhookLogic(status, external_reference, res) {
  try {
    if (status === 'approved') {
      // Use an atomic update to prevent race conditions.
      // Find an order that matches the ID and is NOT already Processing or Paid.
      const order = await Order.findOneAndUpdate(
        { _id: external_reference, status: { $nin: ['Processing', 'Paid'] } },
        { $set: { status: 'Processing' } },
        { new: true } // Return the updated document
      );

      if (order) {
        // If an order was found and updated, it means this is the first 'approved' webhook to be processed.
        logger.info(`[payment] Webhook: Order ${order._id} status atomically updated to Processing. Enqueueing job.`);
        await addPostPaymentJob(order._id.toString());
      } else {
        // If no order was found/updated, it means another process already handled it.
        logger.info(`[payment] Webhook: Order ${external_reference} is already being processed or is paid. Ignoring duplicate 'approved' webhook.`);
      }

    } else {
      // For other statuses, a simple update is likely fine, but we can be safe.
      let newOrderStatus;
      if (status === 'pending') newOrderStatus = 'PendingPayment';
      else if (status === 'rejected' || status === 'cancelled') newOrderStatus = 'Cancelled';

      if (newOrderStatus) {
        await Order.updateOne({ _id: external_reference }, { $set: { status: newOrderStatus } });
        logger.info(`[payment] Webhook: Order ${external_reference} status updated to ${newOrderStatus}.`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error(`[payment] Error in webhook processing for external_reference ${external_reference}:`, error);
    res.status(500).send('Internal server error while processing webhook.');
  }
}


module.exports = { showPayment, createMercadoPagoPreference, handleMercadoPagoSuccess, handleMercadoPagoPending, handleMercadoPagoFailure, handleMercadoPagoWebhook };
