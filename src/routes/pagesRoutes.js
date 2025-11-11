const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');
const pagesController = require('../controllers/pagesController');
const { isAuthPage } = require('../middleware/auth');

router.get('/', pagesController.showHomePage);
router.get('/lista', listController.showListPage);
router.get('/meus-anuncios', pagesController.showMyListingsPage);
router.get('/checkout-success', pagesController.showCheckoutSuccessPage);
router.get('/meus-pedidos', pagesController.showMyOrdersPage);
router.get('/meus-pedidos/:id', pagesController.showOrderDetailPage);
router.get('/perfil', pagesController.showProfilePage);
router.get('/perfil/:id', pagesController.showProfilePage);
router.get('/encyclopedia', pagesController.getEncyclopediaPage);
router.get('/timeline', pagesController.showTimelinePage);
router.get('/comunidade', pagesController.showCommunityPage);
router.get('/about', pagesController.showAboutPage);
router.get('/decks', pagesController.showDecksPage);
router.get('/deck-builder', isAuthPage, pagesController.showDeckBuilderPage);
router.get('/deck-builder/:id', isAuthPage, pagesController.showDeckBuilderPage);
router.get('/my-decks', isAuthPage, pagesController.showMyDecksPage);

module.exports = router;