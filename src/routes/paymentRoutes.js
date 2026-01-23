// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isAuthPage } = require('../middleware/auth');

/**
 * @fileoverview Rotas para o processo de pagamento.
 * @requires express
 * @requires ../controllers/paymentController
 * @requires ../middleware/auth
 */

/**
 * Rota para exibir a página de seleção de pagamento.
 * @name GET /payment/
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.get('/', isAuthPage, paymentController.showPayment);

/**
 * Rota para criar uma preferência de pagamento do Mercado Pago.
 * @name POST /payment/mercadopago/create-preference
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.post('/mercadopago/create-preference', isAuthPage, paymentController.createMercadoPagoPreference);

/**
 * Rota de retorno para pagamentos bem-sucedidos do Mercado Pago.
 * @name GET /payment/mercadopago/success
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.get('/mercadopago/success', isAuthPage, paymentController.handleMercadoPagoSuccess);

/**
 * Rota de retorno para pagamentos pendentes do Mercado Pago.
 * @name GET /payment/mercadopago/pending
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.get('/mercadopago/pending', isAuthPage, paymentController.handleMercadoPagoPending);

/**
 * Rota de retorno para pagamentos com falha do Mercado Pago.
 * @name GET /payment/mercadopago/failure
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.get('/mercadopago/failure', isAuthPage, paymentController.handleMercadoPagoFailure);

/**
 * Rota para o webhook de notificações do Mercado Pago.
 * @name POST /payment/mercadopago/webhook
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.post('/mercadopago/webhook', paymentController.handleMercadoPagoWebhook);

/**
 * Rota para criar um link de pagamento da InfinitePay.
 * @name POST /payment/infinitepay/create-link
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.post('/infinitepay/create-link', isAuthPage, paymentController.createInfinitePayCheckoutLink);

/**
 * Rota de retorno do checkout da InfinitePay.
 * @name GET /payment/infinitepay/return
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.get('/infinitepay/return', isAuthPage, paymentController.handleInfinitePayReturn);

/**
 * Rota para webhook da InfinitePay.
 * @name POST /payment/infinitepay/webhook
 * @function
 * @memberof module:routes/paymentRoutes
 * @inner
 */
router.post('/infinitepay/webhook', paymentController.handleInfinitePayWebhook);

module.exports = router;
