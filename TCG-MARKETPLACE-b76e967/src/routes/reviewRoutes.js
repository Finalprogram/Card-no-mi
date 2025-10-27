// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthPage } = require('../middleware/auth');

// Rota para exibir o formulário de avaliação
router.get('/avaliar/:orderId/:itemId', isAuthPage, reviewController.showReviewForm);

// Rota para submeter a avaliação
router.post('/avaliar', isAuthPage, reviewController.submitReview);

module.exports = router;
