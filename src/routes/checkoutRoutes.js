// src/routes/checkoutRoutes.js
const express = require('express');
const router = express.Router();
const checkout = require('../controllers/checkoutController');
const { isAuthApi } = require('../middleware/auth');

/**
 * @fileoverview Rotas para o processo de checkout.
 * @requires express
 * @requires ../controllers/checkoutController
 * @requires ../middleware/auth
 */

/**
 * Rota para exibir a página de checkout.
 * @name GET /checkout/
 * @function
 * @memberof module:routes/checkoutRoutes
 * @inner
 */
router.get('/', checkout.showCheckout);

/**
 * Rota para obter uma cotação detalhada de frete.
 * @name POST /checkout/quote-detailed
 * @function
 * @memberof module:routes/checkoutRoutes
 * @inner
 */
router.post('/quote-detailed', checkout.quoteDetailed);

/**
 * Rota para confirmar o pedido.
 * @name POST /checkout/confirm
 * @function
 * @memberof module:routes/checkoutRoutes
 * @inner
 */
router.post('/confirm', checkout.confirm);

/**
 * Rota para obter os totais atualizados do pedido.
 * @name POST /checkout/get-updated-totals
 * @function
 * @memberof module:routes/checkoutRoutes
 * @inner
 */
router.post('/get-updated-totals', checkout.getUpdatedTotals);

module.exports = router;
