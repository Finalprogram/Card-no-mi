const express = require('express');
const router = express.Router();
const pagesController = require('../controllers/pagesController');
const authController = require('../controllers/authController');
const User = require('../models/User');
const { isAuthPage } = require('../middleware/auth');
const sellerController = require('../controllers/sellerController');

/**
 * @fileoverview Rotas para funcionalidades de vendedor.
 * @requires express
 * @requires ../controllers/pagesController
 * @requires ../controllers/authController
 * @requires ../models/User
 * @requires ../middleware/auth
 * @requires ../controllers/sellerController
 */

/**
 * Middleware para garantir que o usuário tem um endereço cadastrado.
 * @param {object} req - O objeto de requisição do Express.
 * @param {object} res - O objeto de resposta do Express.
 * @param {function} next - A função de callback do Express.
 */
const ensureAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.session.user.id);
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

/**
 * Rota para exibir a página de venda.
 * @name GET /vender
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.get('/vender', isAuthPage, ensureAddress, pagesController.showSellPage);

/**
 * Rota para exibir o dashboard do vendedor.
 * @name GET /dashboard-vendedor
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.get('/dashboard-vendedor', isAuthPage, sellerController.showSellerDashboard);

/**
 * Rota para exibir os pedidos vendidos do vendedor.
 * @name GET /meus-pedidos-vendidos
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.get('/meus-pedidos-vendidos', isAuthPage, sellerController.showSoldOrders);

/**
 * Rota para marcar um pedido como enviado.
 * @name POST /pedidos-vendidos/:orderId/marcar-enviado
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.post('/pedidos-vendidos/:orderId/marcar-enviado', isAuthPage, sellerController.markAsShipped);

/**
 * Rota para gerar a etiqueta de envio do Melhor Envio.
 * @name POST /seller/orders/:orderId/generate-label
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.post('/seller/orders/:orderId/generate-label', isAuthPage, sellerController.generateMelhorEnvioLabel);

/**
 * Rota para buscar dados de vendas para o gráfico do dashboard.
 * @name GET /seller/sales-data
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.get('/seller/sales-data', isAuthPage, async (req, res) => {
  try {
    const sellerId = req.session.user.id;
    const period = req.query.period || '7days'; // Default to 7 days
    const salesData = await sellerController.getSalesData(sellerId, period);
    res.json(salesData);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de vendas.' });
  }
});

/**
 * Rota para exibir a página pública de um vendedor com seus anúncios.
 * @name GET /vendedores/:id
 * @function
 * @memberof module:routes/sellerRoutes
 * @inner
 */
router.get('/vendedores/:id', sellerController.getSellerPage);

module.exports = router;
