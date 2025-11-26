const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

/**
 * @fileoverview Rotas para interagir com as cartas (cards).
 * @requires express
 * @requires ../controllers/cardController
 */

/**
 * Rota para exibir a página de exploração de cartas.
 * @name GET /cards
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/cards', cardController.showCardsPage);

/**
 * Rota para exibir a página de detalhes de uma carta.
 * @name GET /card/:id
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/card/:id', cardController.showCardDetailPage);

/**
 * Rota da API para buscar cartas para venda.
 * @name GET /api/cards/search
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/search', cardController.searchCardsForSale);

/**
 * Rota da API para buscar cartas disponíveis para venda.
 * @name GET /api/cards/search-available
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/search-available', cardController.searchAvailableCards);

/**
 * Rota da API para obter todas as cartas para a enciclopédia.
 * @name GET /api/cards/all
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/all', cardController.getAllCards);

/**
 * Rota da API para obter cartas disponíveis (com anúncios ativos) com filtros.
 * IMPORTANTE: Esta rota DEVE vir antes de /api/cards/:id para não ser confundida com um ID.
 * @name GET /api/cards/available
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/available', cardController.getAvailableCards);

/**
 * Rota da API para buscar cartas Líder.
 * IMPORTANTE: Esta rota DEVE vir antes de /api/cards/:id para não ser confundida com um ID.
 * @name GET /api/cards/leaders
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/leaders', cardController.getLeaders);

/**
 * Rota da API para obter detalhes de uma carta por ID.
 * IMPORTANTE: Esta rota DEVE vir após rotas específicas (/available, /leaders, /all, /search, etc).
 * @name GET /api/cards/:id
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/cards/:id', cardController.getCardById);

/**
 * Rota da API para buscar cartas para o deck builder.
 * @name GET /api/decks/search-cards
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/decks/search-cards', cardController.searchForDeckBuilder);

/**
 * Rota de debug para buscar uma carta pelo nome e logar seus detalhes.
 * @name GET /api/debug/card/:name
 * @function
 * @memberof module:routes/cardRoutes
 * @inner
 */
router.get('/api/debug/card/:name', cardController.debugCardSearch);

module.exports = router;