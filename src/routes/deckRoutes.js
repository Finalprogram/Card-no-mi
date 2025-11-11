const express = require('express');
const router = express.Router();
const {
    getDecks,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    parseDeck
} = require('../controllers/deckController');
const { isAuthApi } = require('../middleware/auth');

router.route('/')
    .get(isAuthApi, getDecks)
    .post(isAuthApi, createDeck);

router.route('/parse')
    .post(isAuthApi, parseDeck);

router.route('/:id')
    .get(getDeck)
    .put(isAuthApi, updateDeck)
    .delete(isAuthApi, deleteDeck);

module.exports = router;
