const logger = require('../config/logger');
const Order = require('../models/Order');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Card = require('../models/Card');
const { addItemToCart, purchaseShipments, generateLabels, printLabels } = require('./melhorEnvioClient');
const { estimatePackageDims } = require('./packaging');
const { sendEmail, sendOrderStatusEmail, sendSaleEmail } = require('./emailService');
const { updateSellerBalancesForOrder } = require('./balanceService');
const notificationService = require('./notificationService');

async function getSellerOriginCep(sellerId) {
  const globalCepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (sellerId === 'sem-vendedor') return globalCepOrigem;

  const seller = await User.findByPk(sellerId);
  if (seller && seller.address && seller.address.cep) {
    return seller.address.cep;
  }
  logger.warn(`[processor] Vendedor ${sellerId} sem CEP definido. Usando CEP global.`);
  return globalCepOrigem;
}

async function processOrderPostPayment(orderId) {
  logger.info(`[processor] Processing order ${orderId}`);

  try {
    const order = await Order.findByPk(orderId, {
      include: [{ model: User, as: 'user' }]
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    if (order.status === 'Paid') {
      logger.info(`[processor] Order ${orderId} already processed. Skipping.`);
      return;
    }

    const itemsBySeller = order.items.reduce((acc, item) => {
      const sellerId = item.seller.toString();
      if (!acc[sellerId]) acc[sellerId] = [];
      acc[sellerId].push(item);
      return acc;
    }, {});

    const melhorEnvioCartItems = [];

    for (const sellerId in itemsBySeller) {
      const sellerItems = itemsBySeller[sellerId];
      const chosenShipping = order.shippingSelections.find(sel => sel.sellerId.toString() === sellerId);

      if (!chosenShipping) {
        logger.warn(`[processor] No shipping option selected for seller ${sellerId} in order ${order.id}.`);
        continue;
      }

      const seller = await User.findByPk(sellerId);
      if (!seller) {
        logger.warn(`[processor] Seller ${sellerId} not found for order ${order.id}.`);
        continue;
      }

      const cepOrigem = await getSellerOriginCep(sellerId);
      const { comprimentoCm, larguraCm, alturaCm, pesoKg } = estimatePackageDims(sellerItems);
      const insuranceValue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const shipmentDetails = {
        service: chosenShipping.service,
        agency: null,
        from: {
          name: seller.fullName || seller.username,
          phone: seller.phone,
          email: seller.email,
          document: seller.documentNumber,
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
          address: order.shippingAddress.street,
          complement: order.shippingAddress.complement,
          number: order.shippingAddress.number,
          district: order.shippingAddress.neighborhood,
          city: order.shippingAddress.city,
          state_abbr: order.shippingAddress.state,
          country_id: 'BR',
          postal_code: order.shippingAddress.cep.replace('-', '') || '00000000',
        },
        volumes: [{
          height: alturaCm,
          width: larguraCm,
          length: comprimentoCm,
          weight: pesoKg,
          insurance_value: insuranceValue,
        }],
        products: sellerItems.map(item => ({
          name: item.cardName,
          quantity: item.quantity,
          unitary_value: item.price,
        })),
      };

      try {
        const addedToCart = await addItemToCart(shipmentDetails);
        if (addedToCart && addedToCart.id) {
          melhorEnvioCartItems.push(addedToCart.id);
        } else {
          logger.error(`[processor] Failed to add item to Melhor Envio cart for order ${order.id}, seller ${sellerId}.`, addedToCart);
        }
      } catch (err) {
        const msg = err && err.message ? err.message : '';
        const normalized = msg.toLowerCase();
        if (normalized.includes('remetente') && normalized.includes('destinat')) {
          logger.warn(`[processor] Melhor Envio recusou frete (remetente=destinatário) para order ${order.id}, seller ${sellerId}. Continuando sem frete.`);
          continue;
        }
        throw err;
      }
    }

    if (melhorEnvioCartItems.length > 0) {
      const purchasedShipments = await purchaseShipments(melhorEnvioCartItems);
      logger.info(`[processor] Shipments purchased from Melhor Envio for order ${order.id}:`, purchasedShipments);

      if (!purchasedShipments || !purchasedShipments.purchase || !purchasedShipments.purchase.orders || !Array.isArray(purchasedShipments.purchase.orders)) {
        throw new Error(`[processor] Unexpected response structure from purchaseShipments: ${JSON.stringify(purchasedShipments)}`);
      }

      const shipmentIdsToPrint = purchasedShipments.purchase.orders.map(o => o.id);

      await generateLabels(shipmentIdsToPrint);
      logger.info(`[processor] Labels for order ${order.id} queued for generation.`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const printResponse = await printLabels(shipmentIdsToPrint);
      logger.info(`[processor] Public print links from Melhor Envio for order ${order.id}:`, printResponse);

      order.melhorEnvioShipmentId = shipmentIdsToPrint.join(',');
      order.melhorEnvioLabelUrl = printResponse.url;
      order.melhorEnvioService = order.shippingSelections.map(s => s.name).join(', ');
      order.melhorEnvioTrackingUrl = purchasedShipments.purchase.orders[0]?.tracking;

    } else {
      logger.warn(`[processor] No items were added to Melhor Envio cart for order ${order.id}.`);
    }

    for (const item of order.items) {
      const listing = await Listing.findByPk(item.listing);
      if (listing) {
        listing.quantity -= item.quantity;
        await listing.save();
        logger.info(`[processor] Stock for listing ${listing.id} reduced by ${item.quantity}. New stock: ${listing.quantity}`);
      } else {
        logger.warn(`[processor] Listing ${item.listing} not found to reduce stock for order ${order.id}.`);
      }
    }

    order.status = 'Paid';
    await order.save();
    logger.info(`[processor] Order ${orderId} status updated to Paid.`);

    await updateSellerBalancesForOrder(orderId);
    logger.info(`[processor] Seller balances updated for order ${orderId}`);

    await notificationService.notifyOrderStatus(order.user.id, orderId, 'Paid');
    if (order.user && order.user.email) {
      await sendOrderStatusEmail(order.user.email, orderId, 'Paid', { name: order.user.fullName || order.user.username });
    }

    const buyerUsername = order.user.username || order.user.fullName;
    for (const item of order.items) {
      const listing = await Listing.findByPk(item.listing, {
        include: [{ model: Card, as: 'card' }]
      });
      const seller = await User.findByPk(item.seller);
      if (listing) {
        const cardName = listing.card?.name || 'Carta';
        const totalPrice = item.price * item.quantity;
        await notificationService.notifySale(
          item.seller,
          buyerUsername,
          cardName,
          item.quantity,
          totalPrice,
          orderId
        );
        if (seller && seller.email) {
          await sendSaleEmail(seller.email, orderId, cardName, item.quantity, totalPrice, { name: seller.fullName || seller.username });
        }
      }
    }
    logger.info(`[processor] Notifications sent for order ${orderId}`);
  } catch (error) {
    logger.error(`[processor] Error processing order ${orderId}:`, error);
    if (process.env.ADMIN_EMAIL) {
      const subject = `Error processing order ${orderId}`;
      const content = `<p>An error occurred while processing order ${orderId}.</p><p>Error: ${error.message}</p>`;
      sendEmail(process.env.ADMIN_EMAIL, subject, content);
    }
    throw error;
  }
}

module.exports = { processOrderPostPayment };
