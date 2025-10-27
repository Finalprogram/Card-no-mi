const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

// A ÚNICA rota principal para explorar as cartas
router.get('/cards', cardController.showCardsPage);
// A rota de detalhes continua a mesma
router.get('/card/:id', cardController.showCardDetailPage);
// A API para a página de venda também continua
router.get('/api/cards/search', cardController.searchCardsForSale);
router.get('/api/cards/search-available', cardController.searchAvailableCards);

// Rota para a enciclopédia de cartas
router.get('/api/cards/all', cardController.getAllCards);

module.exports = router;