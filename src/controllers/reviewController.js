// src/controllers/reviewController.js
const Order = require('../models/Order');
const Review = require('../models/Review');

async function ensureOrderItemIds(order) {
  const items = order.items || [];
  let changed = false;

  const normalized = items.map((item, index) => {
    if (item.id || item._id) {
      return { ...item, id: item.id || item._id, _id: item._id || item.id };
    }

    const itemId = item.listing || item.card || `${order.id}-${index}`;
    changed = true;
    return { ...item, id: itemId, _id: itemId };
  });

  if (changed) {
    await Order.update(
      { items: normalized },
      { where: { id: order.id } }
    );
  }

  return normalized;
}

const showReviewForm = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ where: { id: orderId, userId: userId } });

    if (!order) {
      return res.status(404).send('Pedido não encontrado ou não pertence a você.');
    }

    const normalizedItems = await ensureOrderItemIds(order);
    const itemToReview = normalizedItems.find(item => item.id.toString() === itemId);

    if (!itemToReview) {
      return res.status(404).send('Item não encontrado neste pedido.');
    }

    if (itemToReview.isReviewed) {
        return res.status(400).send('Este item já foi avaliado.');
    }

    res.render('pages/review-form', { order, item: itemToReview });

  } catch (error) {
    console.error("Erro ao exibir formulário de avaliação:", error);
    res.status(500).send('Erro no servidor.');
  }
};

const submitReview = async (req, res) => {
    try {
        const { orderId, itemId, sellerId, rating, comment } = req.body;
        const buyerId = req.session.user.id;

        // Validação básica
        if (!orderId || !itemId || !sellerId || !rating) {
            return res.status(400).send('Dados da avaliação incompletos.');
        }

        // Verifica se o pedido pertence ao comprador
        const order = await Order.findOne({ where: { id: orderId, userId: buyerId } });
        if (!order) {
            return res.status(403).send('Você não tem permissão para avaliar este pedido.');
        }

        const normalizedItems = await ensureOrderItemIds(order);
        const itemInOrder = normalizedItems.find(item => item.id.toString() === itemId);
        if (!itemInOrder) {
            return res.status(404).send('Item não encontrado no pedido.');
        }

        if (itemInOrder.isReviewed) {
            return res.status(400).send('Este item já foi avaliado.');
        }

        // Cria a nova avaliação
        await Review.create({
            orderId: orderId,
            orderItemId: itemId,
            sellerId: sellerId,
            buyerId: buyerId,
            rating: parseInt(rating, 10),
            comment: comment,
        });

        // Marca o item como avaliado no pedido
        const updatedItems = normalizedItems.map(item => {
            if (item.id.toString() === itemId) {
                return { ...item, isReviewed: true };
            }
            return item;
        });

        await Order.update(
            { items: updatedItems },
            { where: { id: orderId } }
        );

        res.redirect('/meus-pedidos');

    } catch (error) {
        console.error("Erro ao submeter avaliação:", error);
        // Se for erro de duplicidade
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).send('Você já avaliou este item.');
        }
        res.status(500).send('Erro no servidor.');
    }
};

module.exports = { showReviewForm, submitReview };
