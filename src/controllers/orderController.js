const Order = require('../models/Order');

const confirmReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Pedido não encontrado.');
    }

    if (order.user.toString() !== userId) {
      return res.status(403).send('Você não tem permissão para confirmar o recebimento deste pedido.');
    }

    if (order.status !== 'Shipped') {
      return res.status(400).send('Este pedido não pode ser confirmado como recebido.');
    }

    order.status = 'Delivered';
    await order.save();

    res.redirect(`/meus-pedidos/${orderId}`);

  } catch (error) {
    console.error('Erro ao confirmar o recebimento do pedido:', error);
    res.status(500).send('Erro no servidor');
  }
};

module.exports = {
  confirmReceipt,
};