const express = require('express');
const router = express.Router();
const {
    getMyDecks,
    getDecks,
    getCommunityDecks
} = require('../controllers/deckController');
const { isAuthPage } = require('../middleware/auth');

// @route   GET /decks
// @desc    Render the "My Decks" page
router.route('/')
    .get(isAuthPage, getMyDecks);

// @route   GET /decks/all
// @desc    Render the "All Decks" page
router.route('/all')
    .get(isAuthPage, getDecks);

// @route   GET /decks/community
// @desc    Render the "Community Decks" page
router.route('/community')
    .get(getCommunityDecks);

module.exports = router;
