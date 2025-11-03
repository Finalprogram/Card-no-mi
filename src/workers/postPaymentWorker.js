// src/workers/postPaymentWorker.js
const { Worker } = require('bullmq');
const { redisConnection } = require('../services/postPaymentQueue');
const logger = require('../config/logger');
const Order = require('../models/Order');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { addItemToCart, purchaseShipments, printLabels } = require('../services/melhorEnvioClient');
const { estimatePackageDims } = require('../services/packaging');
const { sendEmail } = require('../services/emailService');
const fs = require('fs').promises;
const path = require('path');

// Helper function to get seller's origin CEP (copied from paymentController)
async function getSellerOriginCep(sellerId) {
  const globalCepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (sellerId === 'sem-vendedor') return globalCepOrigem;

  const seller = await User.findById(sellerId);
  if (seller && seller.address && seller.address.cep) {
    return seller.address.cep;
  }
  logger.warn(`[worker] Vendedor ${sellerId} sem CEP definido. Usando CEP global.`);
  return globalCepOrigem;
}

const worker = new Worker('post-payment', async (job) => {
  const { orderId } = job.data;
  logger.info(`[worker] Processing job for order ${orderId}`);

  try {
    const order = await Order.findById(orderId).populate('user');

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    // Idempotency check: if order is already processed, skip.
    if (order.status === 'Paid') {
        logger.info(`[worker] Order ${orderId} has already been processed. Skipping.`);
        return;
    }

    // --- Start of logic from processWebhookLogic ---
    const itemsBySeller = order.items.reduce((acc, item) => {
      const sellerId = item.seller.toString();
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
        logger.warn(`[worker] No shipping option selected for seller ${sellerId} in order ${order._id}.`);
        continue;
      }

      const seller = await User.findById(sellerId);
      if (!seller) {
        logger.warn(`[worker] Seller ${sellerId} not found for order ${order._id}.`);
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

      const addedToCart = await addItemToCart(shipmentDetails);
      if (addedToCart && addedToCart.id) {
        melhorEnvioCartItems.push(addedToCart.id);
        orderMelhorEnvioIds.push(addedToCart.id);
      } else {
        logger.error(`[worker] Failed to add item to Melhor Envio cart for order ${order._id}, seller ${sellerId}.`, addedToCart);
        // Optionally, you could throw an error here to force a retry of the job
      }
    }

    if (melhorEnvioCartItems.length > 0) {
      const purchasedShipments = await purchaseShipments(melhorEnvioCartItems);
      logger.info(`[worker] Shipments purchased from Melhor Envio for order ${order._id}:`, purchasedShipments);

      const pdfArrayBuffer = await printLabels(orderMelhorEnvioIds);

      // Define um caminho para salvar o PDF
      const labelDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'labels');
      await fs.mkdir(labelDir, { recursive: true }); // Garante que o diretório exista
      const labelFileName = `label-${order._id}.pdf`;
      const labelPath = path.join(labelDir, labelFileName);

      // Salva o buffer do PDF em um arquivo
      await fs.writeFile(labelPath, Buffer.from(pdfArrayBuffer));
      logger.info(`[worker] Label for order ${order._id} saved to ${labelPath}`);

      // A URL a ser salva no banco de dados é agora uma URL local
      const labelUrl = `/uploads/labels/${labelFileName}`;

      order.melhorEnvioShipmentId = orderMelhorEnvioIds.join(',');
      order.melhorEnvioLabelUrl = labelUrl; // Salva a URL local
      order.melhorEnvioService = order.shippingSelections.map(s => s.name).join(', ');
      order.melhorEnvioTrackingUrl = purchasedShipments[0]?.tracking;

      logger.info(`[worker] Order #${order._id} updated with Melhor Envio data.`);

      // Reduce stock AFTER successful Melhor Envio integration
      for (const item of order.items) {
        const listing = await Listing.findById(item.listing);
        if (listing) {
          listing.quantity -= item.quantity;
          await listing.save();
          logger.info(`[worker] Stock for listing ${listing._id} reduced by ${item.quantity}. New stock: ${listing.quantity}`);
        } else {
          logger.warn(`[worker] Listing ${item.listing} not found to reduce stock for order ${order._id}.`);
        }
      }
    } else {
      logger.warn(`[worker] No items were added to Melhor Envio cart for order ${order._id}.`);
    }
    // --- End of logic from processWebhookLogic ---

    // Finally, update the order status
    order.status = 'Paid';
    await order.save();
    logger.info(`[worker] Order ${orderId} status updated to Paid.`);

  } catch (error) {
    logger.error(`[worker] Error processing order ${orderId}:`, error);
    if (process.env.ADMIN_EMAIL) {
      const subject = `Error processing order ${orderId}`;
      const content = `<p>An error occurred while processing order ${orderId}.</p><p>Error: ${error.message}</p>`;
      sendEmail(process.env.ADMIN_EMAIL, subject, content);
    }
    // The job will be retried automatically based on the queue's backoff strategy.
    throw error; // Re-throw error to let BullMQ know the job failed
  }
}, { connection: redisConnection });

worker.on('completed', (job) => {
  logger.info(`[worker] Job ${job.id} has completed.`);
});

worker.on('failed', (job, err) => {
  logger.error(`[worker] Job ${job.id} has failed with ${err.message}`);
});

logger.info('[worker] Post-payment worker started.');
