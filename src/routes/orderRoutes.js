const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthPage } = require('../middleware/auth');

// Rota para confirmar o recebimento de um pedido
router.post('/meus-pedidos/:orderId/confirmar-recebimento', isAuthPage, orderController.confirmReceipt);

module.exports = router;
