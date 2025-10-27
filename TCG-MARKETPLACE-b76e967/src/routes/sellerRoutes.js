const express = require('express');
const router = express.Router();
const pagesController = require('../controllers/pagesController');
const authController = require('../controllers/authController');
const User = require('../models/User');
const { isAuthPage } = require('../middleware/auth');
const sellerController = require('../controllers/sellerController');

// Middleware para garantir que o endereço está cadastrado
const ensureAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (user && user.address && user.address.cep) {
      return next(); // Endereço existe, pode prosseguir
    }
    // Se não tiver endereço, redireciona para a página de perfil para preenchimento
    res.redirect(`/perfil/${req.session.user.username}`);
  } catch (error) {
    console.error('Erro no middleware ensureAddress:', error);
    res.redirect('/');
  }
};

// As rotas de / e /perfil deveriam estar em pagesRoutes, mas mantendo aqui por enquanto.
router.get('/', pagesController.showHomePage);
router.get('/perfil/:username', pagesController.showProfilePage);

// Rota de vender protegida por autenticação e verificação de endereço
router.get('/vender', isAuthPage, ensureAddress, pagesController.showSellPage);

// Nova rota para o formulário da página de perfil
router.post('/profile/update', isAuthPage, authController.updateAddress);

// Rota para o Dashboard do Vendedor
router.get('/dashboard-vendedor', isAuthPage, sellerController.showSellerDashboard);

// Rota para a página de pedidos vendidos do vendedor
router.get('/meus-pedidos-vendidos', isAuthPage, sellerController.showSoldOrders);

// Rota para marcar um pedido como enviado
router.post('/pedidos-vendidos/:orderId/marcar-enviado', isAuthPage, sellerController.markAsShipped);

// Nova rota para gerar etiqueta do Melhor Envio
router.post('/orders/:orderId/generate-label', isAuthPage, sellerController.generateMelhorEnvioLabel);

module.exports = router;