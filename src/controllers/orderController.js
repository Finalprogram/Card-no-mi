const Order = require('../models/Order');
const logger = require('../config/logger');
const notificationService = require('../services/notificationService');

const confirmReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).send('Pedido não encontrado.');
    }

    if (order.userId.toString() !== userId) {
      return res.status(403).send('Você não tem permissão para confirmar o recebimento deste pedido.');
    }

    if (order.status !== 'Shipped') {
      return res.status(400).send('Este pedido não pode ser confirmado como recebido.');
    }

    order.status = 'Delivered';
    await order.save();

    // Notificar comprador que pedido foi entregue
    await notificationService.notifyOrderStatus(userId, orderId, 'Delivered');

    logger.info(`[Order Update] Order #${orderId} status changed to Delivered by User ID: ${userId}.`);

    res.redirect(`/meus-pedidos/${orderId}`);

  } catch (error) {
    logger.error(`Error confirming receipt for order ID ${req.params.orderId}:`, error);
    res.status(500).send('Erro no servidor');
  }
};

module.exports = {
  confirmReceipt,
};
