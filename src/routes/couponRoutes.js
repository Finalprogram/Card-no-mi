const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

router.post('/apply', couponController.applyCoupon);
router.post('/remove', couponController.removeCoupon);

module.exports = router;