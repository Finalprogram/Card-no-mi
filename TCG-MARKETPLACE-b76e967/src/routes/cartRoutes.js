// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// Se quiser proteger com login em todas as rotas, adicione seu middleware aqui:
// const { isAuth } = require('../middleware/auth');
// router.use(isAuth);

router.get('/', cartController.show);
router.post('/add', cartController.add);
router.post('/update', cartController.update);
router.post('/remove', cartController.remove);
router.post('/clear', cartController.clear);
router.get('/json', cartController.json);

module.exports = router;
