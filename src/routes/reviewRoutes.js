// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthPage } = require('../middleware/auth');

/**
 * @fileoverview Rotas para o sistema de avaliações.
 * @requires express
 * @requires ../controllers/reviewController
 * @requires ../middleware/auth
 */

/**
 * Rota para exibir o formulário de avaliação de um item de um pedido.
 * @name GET /avaliar/:orderId/:itemId
 * @function
 * @memberof module:routes/reviewRoutes
 * @inner
 * @param {string} req.params.orderId - O ID do pedido.
 * @param {string} req.params.itemId - O ID do item no pedido.
 */
router.get('/avaliar/:orderId/:itemId', isAuthPage, reviewController.showReviewForm);

/**
 * Rota para submeter uma avaliação.
 * @name POST /avaliar
 * @function
 * @memberof module:routes/reviewRoutes
 * @inner
 */
router.post('/avaliar', isAuthPage, reviewController.submitReview);

module.exports = router;
