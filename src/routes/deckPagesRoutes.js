const express = require('express');
const router = express.Router();
const {
    getDecks,
    getCommunityDecks
} = require('../controllers/deckController');
const { isAuthPage } = require('../middleware/auth');

// @route   GET /decks
// @desc    Render the "My Decks" page
router.route('/')
    .get(isAuthPage, getDecks);

// @route   GET /decks/community
// @desc    Render the "Community Decks" page
router.route('/community')
    .get(getCommunityDecks);

module.exports = router;
