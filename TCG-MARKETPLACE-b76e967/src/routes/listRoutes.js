const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

router.post('/list/add', listController.addToList);
router.post('/list/filter-sellers', listController.filterSellers);
router.post('/list/remove', listController.removeFromList);
module.exports = router;