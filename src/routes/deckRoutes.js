const express = require('express');
const router = express.Router();
const {
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    parseDeck,
    searchCards
} = require('../controllers/deckController');
const { isAuthApi } = require('../middleware/auth');

router.route('/search-cards')
    .get(isAuthApi, searchCards);

router.route('/')
    .post(isAuthApi, createDeck);

router.route('/parse')
    .post(isAuthApi, parseDeck);

router.route('/:id')
    .get(isAuthApi, getDeck)
    .put(isAuthApi, updateDeck)
    .delete(isAuthApi, deleteDeck);

module.exports = router;
