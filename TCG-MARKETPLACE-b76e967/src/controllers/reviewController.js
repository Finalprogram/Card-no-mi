// src/controllers/reviewController.js
const Order = require('../models/Order');
const Review = require('../models/Review');

const showReviewForm = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.card');

    if (!order) {
      return res.status(404).send('Pedido não encontrado ou não pertence a você.');
    }

    const itemToReview = order.items.find(item => item._id.toString() === itemId);

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
        const order = await Order.findOne({ _id: orderId, user: buyerId });
        if (!order) {
            return res.status(403).send('Você não tem permissão para avaliar este pedido.');
        }

        const itemInOrder = order.items.find(item => item._id.toString() === itemId);
        if (!itemInOrder) {
            return res.status(404).send('Item não encontrado no pedido.');
        }

        if (itemInOrder.isReviewed) {
            return res.status(400).send('Este item já foi avaliado.');
        }

        // Cria a nova avaliação
        const newReview = new Review({
            order: orderId,
            orderItemId: itemId,
            seller: sellerId,
            buyer: buyerId,
            rating: parseInt(rating, 10),
            comment: comment,
        });

        await newReview.save();

        // Marca o item como avaliado no pedido
        await Order.updateOne(
            { _id: orderId, 'items._id': itemId },
            { $set: { 'items.$.isReviewed': true } }
        );

        res.redirect('/meus-pedidos');

    } catch (error) {
        console.error("Erro ao submeter avaliação:", error);
        // Se for erro de duplicidade
        if (error.code === 11000) {
            return res.status(400).send('Você já avaliou este item.');
        }
        res.status(500).send('Erro no servidor.');
    }
};

module.exports = { showReviewForm, submitReview };