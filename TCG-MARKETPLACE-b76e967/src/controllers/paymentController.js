// src/controllers/paymentController.js

const Order = require('../models/Order');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const logger = require('../config/logger');

// Configura as credenciais do Mercado Pago
logger.info("MERCADO_PAGO_ACCESS_TOKEN:", process.env.MERCADO_PAGO_ACCESS_TOKEN ? "Loaded" : "Not Loaded");
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN, options: { timeout: 5000 } });
const preference = new Preference(client);

/** GET /payment */
function showPayment(req, res) {
  res.render('pages/payment');
}

/** POST /payment/process */
async function processPayment(req, res) {
  try {
    const { paymentMethod } = req.body;
    const cart = req.session.cart;
    const totals = req.session.totals;
    const userId = req.session.user.id;

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).send('Carrinho vazio ou inválido.');
    }

    // Para o endereço, vamos usar um placeholder por enquanto, como definido no checkout
    // Em um fluxo real, pegaríamos o endereço selecionado pelo usuário
    const placeholderAddress = "Endereço de entrega placeholder";

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

    const newOrder = new Order({
      user: userId,
      items: orderItems,
      totals: totals,
      shippingAddress: placeholderAddress,
      status: 'Processing',
    });

    await newOrder.save();

    // Atualiza a quantidade do anúncio
    for (const item of orderItems) {
      if (item.listing) {
        try {
          const listing = await Listing.findById(item.listing);
          if (listing) {
            listing.quantity -= item.quantity;
            if (listing.quantity < 0) {
              listing.quantity = 0; // Garante que a quantidade não fique negativa
            }
            await listing.save();
            logger.info(`[payment] Quantidade atualizada para o anúncio #${item.listing}. Nova quantidade: ${listing.quantity}`);
          } else {
            logger.warn(`[payment] Anúncio com ID #${item.listing} não encontrado para atualização de quantidade.`);
          }
        } catch (error) {
          logger.error(`[payment] Erro ao atualizar a quantidade para o anúncio #${item.listing}:`, error);
          // Decida se quer interromper o processo ou apenas registrar o erro
        }
      }
    }

    logger.info(`[payment] Pedido #${newOrder._id} criado com o método: ${paymentMethod}`);

    // Limpa o carrinho da sessão após a compra
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };

    res.redirect('/checkout-success');

  } catch (error) {
    logger.error('Erro ao processar pagamento e criar pedido:', error);
    res.status(500).send('Erro ao finalizar o pedido.');
  }
}

async function createMercadoPagoPreference(req, res) {
  try {
    const cart = req.session.cart;
    const totals = req.session.totals;
    const userId = req.session.user.id;

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ message: 'Carrinho vazio ou inválido.' });
    }

    // Para o endereço, vamos usar um placeholder por enquanto, como definido no checkout
    // Em um fluxo real, pegaríamos o endereço selecionado pelo usuário
    const placeholderAddress = "Endereço de entrega placeholder"; // TODO: Obter endereço real do usuário

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

    // Cria o pedido no banco de dados com status 'Processing' (ou 'PendingPayment')
    const newOrder = new Order({
      user: userId,
      items: orderItems,
      totals: totals,
      shippingAddress: placeholderAddress,
      status: 'Processing', // Ou 'PendingPayment' se preferir um status mais específico
    });

    await newOrder.save();
    logger.info(`[payment] Pedido #${newOrder._id} criado para Mercado Pago.`);

    const items = cart.items.map(item => ({
      title: item.meta.cardName,
      unit_price: Number(item.price),
      quantity: Number(item.qty),
    }));

    const preferenceBody = {
      items,
      external_reference: newOrder._id.toString(), // Usar o ID do pedido como referência externa
      back_urls: {
        success: `${process.env.BASE_URL}/payment/mercadopago/success`, // Usar BASE_URL
        pending: `${process.env.BASE_URL}/payment/mercadopago/pending`, // Usar BASE_URL
        failure: `${process.env.BASE_URL}/payment/mercadopago/failure`, // Usar BASE_URL
      },
      notification_url: `${process.env.BASE_URL}/payment/mercadopago/webhook`, // Adicionar URL de notificação
      total_amount: totals.grand,
    };

    const response = await preference.create({ body: preferenceBody });

    // Limpa o carrinho da sessão após a criação da preferência
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };

    res.json({ init_point: response.init_point, orderId: newOrder._id });

  } catch (error) {
    logger.error("Erro ao criar preferência do Mercado Pago:", error);
    res.status(500).json({ message: "Erro ao criar preferência de pagamento." });
  }
}

async function handleMercadoPagoSuccess(req, res) {
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
  logger.info("Mercado Pago Success:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });

  try {
    if (external_reference) {
      const order = await Order.findById(external_reference);
      if (order && order.status !== 'Processing') { // Evita atualizar se já foi processado pelo webhook
        order.status = 'Processing'; // Ou 'Paid'
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'Processing' via retorno de sucesso MP.`);
      }
    }
    // Limpar o carrinho do usuário, pois o pedido foi criado e pago
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
    res.render('pages/checkout-success', { message: "Pagamento aprovado!", paymentStatus: status });
  } catch (error) {
    logger.error('Erro ao processar retorno de sucesso do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status });
  }
}

async function handleMercadoPagoPending(req, res) {
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
  logger.info("Mercado Pago Pending:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });

  try {
    if (external_reference) {
      const order = await Order.findById(external_reference);
      if (order && order.status !== 'Processing') { // Evita atualizar se já foi processado pelo webhook
        order.status = 'Processing'; // Ou 'PendingPayment'
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'Processing' via retorno pendente MP.`);
      }
    }
    // Não limpar o carrinho aqui, pois o pagamento ainda está pendente
    res.render('pages/checkout-success', { message: "Pagamento pendente.", paymentStatus: status });
  } catch (error) {
    logger.error('Erro ao processar retorno pendente do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status });
  }
}

async function handleMercadoPagoFailure(req, res) {
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
  logger.info("Mercado Pago Failure:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });

  try {
    if (external_reference) {
      const order = await Order.findById(external_reference);
      if (order && order.status !== 'Cancelled') { // Evita atualizar se já foi cancelado pelo webhook
        order.status = 'Cancelled';
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'Cancelled' via retorno de falha MP.`);
      }
    }
    // Não limpar o carrinho aqui, pois o pagamento falhou e o usuário pode tentar novamente
    res.render('pages/checkout-success', { message: "Pagamento falhou.", paymentStatus: status });
  } catch (error) {
    logger.error('Erro ao processar retorno de falha do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status });
  }
}
async function handleMercadoPagoWebhook(req, res) {
  logger.info('Webhook Mercado Pago recebido:', req.query, req.body);

  const { topic, id } = req.query; // 'id' aqui é o ID da notificação, não do pagamento

  if (!topic || !id) {
    logger.warn('Webhook Mercado Pago: Tópico ou ID ausente.', req.query);
    return res.status(400).send('Tópico ou ID ausente.');
  }

  try {
    let paymentId;
    if (topic === 'payment') {
      paymentId = id; // Para o tópico 'payment', o ID é o ID do pagamento
    } else if (topic === 'merchant_order') {
      // Se for merchant_order, precisamos buscar os pagamentos associados
      // Para simplificar, vamos focar no tópico 'payment' por enquanto.
      logger.info(`Webhook Mercado Pago: Tópico ${topic} recebido, ignorando por enquanto.`);
      return res.status(200).send('OK');
    } else {
      logger.info(`Webhook Mercado Pago: Tópico ${topic} desconhecido, ignorando.`);
      return res.status(200).send('OK');
    }

    if (!paymentId) {
      logger.warn('Webhook Mercado Pago: ID do pagamento não determinado.');
      return res.status(400).send('ID do pagamento não determinado.');
    }

    // 1. Buscar detalhes do pagamento na API do Mercado Pago
    const payment = await client.payments.get({ id: Number(paymentId) });
    logger.info('Detalhes do pagamento do Mercado Pago:', payment);

    const { status, external_reference } = payment;

    if (!external_reference) {
      logger.error('Webhook Mercado Pago: external_reference ausente no pagamento.', payment);
      return res.status(400).send('external_reference ausente.');
    }

    // 2. Encontrar o pedido no seu banco de dados
    const order = await Order.findById(external_reference);

    if (!order) {
      logger.error(`Webhook Mercado Pago: Pedido com ID ${external_reference} não encontrado.`);
      return res.status(404).send('Pedido não encontrado.');
    }

    // 3. Atualizar o status do pedido
    let newOrderStatus = order.status;
    if (status === 'approved') {
      newOrderStatus = 'Processing'; // Ou 'Paid', dependendo do seu fluxo
    } else if (status === 'pending') {
      newOrderStatus = 'Processing'; // Ou 'PendingPayment'
    } else if (status === 'rejected' || status === 'cancelled') {
      newOrderStatus = 'Cancelled';
    }

    if (order.status !== newOrderStatus) {
      order.status = newOrderStatus;
      await order.save();
      logger.info(`Pedido #${order._id} atualizado para o status: ${newOrderStatus} via webhook MP.`);
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Erro no webhook do Mercado Pago:', error);
    res.status(500).send('Erro interno do servidor.');
  }
}

module.exports = { showPayment, processPayment, createMercadoPagoPreference, handleMercadoPagoSuccess, handleMercadoPagoPending, handleMercadoPagoFailure, handleMercadoPagoWebhook };
