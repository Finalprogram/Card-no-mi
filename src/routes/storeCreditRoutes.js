const express = require('express');
const { isAuthPage, isAuthApi } = require('../middleware/auth');
const { listStoreCreditsPage, redeemCredit } = require('../controllers/storeCreditController');

const router = express.Router();

router.get('/store/credits', isAuthPage, listStoreCreditsPage);
router.post('/store/credits/:id/redeem', isAuthApi, redeemCredit);

module.exports = router;
