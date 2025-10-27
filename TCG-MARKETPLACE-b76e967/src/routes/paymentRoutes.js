// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { isAuthPage } = require('../middleware/auth');

// Rota para exibir a página de seleção de pagamento
router.get('/', isAuthPage, paymentController.showPayment);

// Rota para processar o pagamento (simulado)
router.post('/process', isAuthPage, paymentController.processPayment);

// Rota para criar preferência de pagamento do Mercado Pago
router.post('/mercadopago/create-preference', isAuthPage, paymentController.createMercadoPagoPreference);

// Rotas de retorno do Mercado Pago
router.get('/mercadopago/success', isAuthPage, paymentController.handleMercadoPagoSuccess);
router.get('/mercadopago/pending', isAuthPage, paymentController.handleMercadoPagoPending);
router.get('/mercadopago/failure', isAuthPage, paymentController.handleMercadoPagoFailure);

// Rota para o webhook de notificações do Mercado Pago
router.post('/mercadopago/webhook', paymentController.handleMercadoPagoWebhook);

module.exports = router;
