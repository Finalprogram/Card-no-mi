// src/controllers/paymentController.js

const Order = require('../models/Order');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const logger = require('../config/logger');
const { cotarFreteMelhorEnvio, addItemToCart, purchaseShipments, printLabels } = require('../services/melhorEnvioClient');
const { estimatePackageDims } = require('../services/packaging');

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
    logger.info(`[payment] Pedido #${newOrder._id} criado para Mercado Pago.`);

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
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
      logger.info("Mercado Pago Success:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });
  
      try {
        let order = null;
        if (external_reference) {
          order = await Order.findById(external_reference).populate('user');
      if (order && order.status !== 'Paid') { 
        order.status = 'Paid';
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'Paid' via retorno de sucesso MP.`);
      }
    }
    // Limpar o carrinho do usuário, pois o pedido foi criado e pago
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
    res.render('pages/checkout-success', { message: "Pagamento aprovado!", paymentStatus: status, totals: order ? order.totals : null });
  } catch (error) {
    logger.error('Erro ao processar retorno de sucesso do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status, totals: null });
  }
}

async function handleMercadoPagoPending(req, res) {
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
  logger.info("Mercado Pago Pending:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });

  try {
    let order = null;
    if (external_reference) {
      order = await Order.findById(external_reference).populate('user');
      if (order && order.status !== 'PendingPayment') { 
        order.status = 'PendingPayment';
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'PendingPayment' via retorno pendente MP.`);
      }
    }
    // Não limpar o carrinho aqui, pois o pagamento ainda está pendente
    res.render('pages/checkout-success', { message: "Pagamento pendente.", paymentStatus: status, totals: order ? order.totals : null });
  } catch (error) {
    logger.error('Erro ao processar retorno pendente do Mercado Pago:', error);
    res.render('pages/checkout-success', { message: "Erro ao processar seu pagamento.", paymentStatus: status, totals: null });
  }
}

async function handleMercadoPagoFailure(req, res) {
  const { collection_id, collection_status, payment_id, status, external_reference, preference_id } = req.query;
  logger.info("Mercado Pago Failure:", { collection_id, collection_status, payment_id, status, external_reference, preference_id });

  try {
    let order = null;
    if (external_reference) {
      order = await Order.findById(external_reference).populate('user');
      if (order && order.status !== 'Cancelled') { // Evita atualizar se já foi cancelado pelo webhook
        order.status = 'Cancelled';
        await order.save();
        logger.info(`Pedido #${order._id} atualizado para status 'Cancelled' via retorno de falha MP.`);
      }
    }
    // Não limpar o carrinho aqui, pois o pagamento falhou e o usuário pode tentar novamente
    res.render('pages/checkout-success', { message: "Pagamento falhou.", paymentStatus: status, totals: order ? order.totals : null });
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
    // 2. Encontrar o pedido no seu banco de dados
    const order = await Order.findById(external_reference).populate('user');

    if (!order) {
      logger.error(`Webhook Mercado Pago: Pedido com ID ${external_reference} não encontrado.`);
      return res.status(404).send('Pedido não encontrado.');
    }

    // 3. Atualizar o status do pedido
    let newOrderStatus = order.status;
    if (status === 'approved') {
      newOrderStatus = 'Paid'; // Ou 'Paid', dependendo do seu fluxo

      // --- Reduzir estoque dos listings ---
      for (const item of order.items) {
        const listing = await Listing.findById(item.listing);
        if (listing) {
          listing.quantity -= item.quantity;
          await listing.save();
          logger.info(`[payment] Estoque do listing ${listing._id} reduzido em ${item.quantity}. Novo estoque: ${listing.quantity}`);
        } else {
          logger.warn(`[payment] Listing ${item.listing} não encontrado para reduzir estoque no pedido ${order._id}.`);
        }
      }
      // --- Fim da redução de estoque ---

      // --- Integração Melhor Envio ---
      try {
        const itemsBySeller = order.items.reduce((acc, item) => {
          const sellerId = item.seller.toString(); // Convert ObjectId to string
          if (!acc[sellerId]) acc[sellerId] = [];
          acc[sellerId].push(item);
          return acc;
        }, {});

        const melhorEnvioCartItems = [];
        const orderMelhorEnvioIds = [];

        for (const sellerId in itemsBySeller) {
          const sellerItems = itemsBySeller[sellerId];
          const chosenShipping = order.shippingSelections.find(sel => sel.sellerId.toString() === sellerId);

          if (!chosenShipping) {
            logger.warn(`[payment] Nenhuma opção de frete selecionada para o vendedor ${sellerId} no pedido ${order._id}.`);
            continue;
          }

          const seller = await User.findById(sellerId);
          if (!seller) {
            logger.warn(`[payment] Vendedor ${sellerId} não encontrado para o pedido ${order._id}.`);
            continue;
          }

          const cepOrigem = await getSellerOriginCep(sellerId);
          const { comprimentoCm, larguraCm, alturaCm, pesoKg } = estimatePackageDims(sellerItems);
          const insuranceValue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

          const shipmentDetails = {
            service: chosenShipping.service,
            agency: null, // Pode ser definido se o vendedor usar uma agência específica
            from: {
              name: seller.fullName || seller.username,
              phone: seller.phone,
              email: seller.email,
              document: seller.documentNumber,
              company_document: null,
              state_register: null,
              address: seller.address.street,
              complement: seller.address.complement,
              number: seller.address.number,
              district: seller.address.neighborhood,
              city: seller.address.city,
              state_abbr: seller.address.state,
              country_id: 'BR',
              postal_code: cepOrigem,
            },
            to: {
              name: order.user.fullName || order.user.username,
              phone: order.user.phone,
              email: order.user.email,
              document: order.user.documentNumber,
              address: order.shippingAddress.street, // Apenas a rua
              complement: order.shippingAddress.complement,
              number: order.shippingAddress.number,
              district: order.shippingAddress.neighborhood,
              city: order.shippingAddress.city,
              state_abbr: order.shippingAddress.state,
              country_id: 'BR',
              postal_code: order.shippingAddress.cep.replace('-', '') || '00000000',
            },
            volumes: [
              {
                height: alturaCm,
                width: larguraCm,
                length: comprimentoCm,
                weight: pesoKg,
                insurance_value: insuranceValue,
              }
            ],
            products: sellerItems.map(item => ({
              name: item.cardName,
              quantity: item.quantity,
              unitary_value: item.price,
            })),
          };

          const addedToCart = await addItemToCart(shipmentDetails);
          if (addedToCart && addedToCart.id) {
            melhorEnvioCartItems.push(addedToCart.id);
            orderMelhorEnvioIds.push(addedToCart.id); // Coleta os IDs para a compra
          } else {
            logger.error(`[payment] Falha ao adicionar item ao carrinho do Melhor Envio para o pedido ${order._id}, vendedor ${sellerId}.`, addedToCart);
          }
        }

        if (melhorEnvioCartItems.length > 0) {
          const purchasedShipments = await purchaseShipments(melhorEnvioCartItems);
          logger.info(`[payment] Envios comprados no Melhor Envio para o pedido ${order._id}:`, purchasedShipments);

          const printResponse = await printLabels(orderMelhorEnvioIds);
          logger.info(`[payment] Links de impressão do Melhor Envio para o pedido ${order._id}:`, printResponse);

          order.melhorEnvioShipmentId = orderMelhorEnvioIds.join(',');
          order.melhorEnvioLabelUrl = printResponse.url;
          order.melhorEnvioService = order.shippingSelections.map(s => s.name).join(', ');
          order.melhorEnvioTrackingUrl = purchasedShipments[0]?.tracking;

          logger.info(`[payment] Pedido #${order._id} atualizado com dados do Melhor Envio.`);
        } else {
          logger.warn(`[payment] Nenhum item adicionado ao carrinho do Melhor Envio para o pedido ${order._id}.`);
        }

      } catch (melhorEnvioError) {
        logger.error(`[payment] Erro na integração com Melhor Envio para o pedido ${order._id}:`, melhorEnvioError);
        if (process.env.ADMIN_EMAIL) {
          const { sendEmail } = require('../services/emailService');
          const subject = `Erro na integração com Melhor Envio - Pedido ${order._id}`;
          const content = `<p>Ocorreu um erro ao processar o envio para o pedido ${order._id}.</p><p>Erro: ${melhorEnvioError.message}</p>`;
          sendEmail(process.env.ADMIN_EMAIL, subject, content);
        } else {
          logger.warn('[payment] ADMIN_EMAIL não definido. Não foi possível enviar email de notificação de erro.');
        }
      }

    } else if (status === 'pending') {
      newOrderStatus = 'PendingPayment';
    } else if (status === 'rejected' || status === 'cancelled') {
      newOrderStatus = 'Cancelled';
    }

    if (order.status !== newOrderStatus) {
      order.status = newOrderStatus;
      await order.save();
      logger.info(`Pedido #${order._id} atualizado para o status: ${newOrderStatus} via webhook MP.`);
    }

    res.status(200).send('OK');




module.exports = { showPayment, createMercadoPagoPreference, handleMercadoPagoSuccess, handleMercadoPagoPending, handleMercadoPagoFailure, handleMercadoPagoWebhook };
