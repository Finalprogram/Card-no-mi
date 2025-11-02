const express = require('express');
const router = express.Router();
const welcomeController = require('../controllers/welcomeController');
const { isAuthPage } = require('../middleware/auth');

router.get('/step1', isAuthPage, welcomeController.showStep1);
router.post('/step1', isAuthPage, welcomeController.handleStep1);
router.get('/step2', isAuthPage, welcomeController.showStep2);
router.post('/step2', isAuthPage, welcomeController.handleStep2);

module.exports = router;