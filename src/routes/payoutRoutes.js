// src/routes/payoutRoutes.js

const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { isAuthPage } = require('../middleware/auth');

// Rotas do vendedor
router.get('/seller/payouts', isAuthPage, payoutController.getSellerPayouts);
router.get('/seller/payouts/:id', isAuthPage, payoutController.getPayoutDetails);
router.post('/seller/payouts/request', isAuthPage, payoutController.requestPayout);

// Rotas administrativas (adicionar middleware de admin depois)
router.get('/admin/payouts', isAuthPage, payoutController.getAdminPayouts);
router.post('/admin/payouts/:id/approve', isAuthPage, payoutController.approvePayout);

module.exports = router;
