const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdminPage, isAdminApi } = require('../middleware/auth');

// Apply isAdminPage middleware to all admin routes
router.use(isAdminPage);

router.get('/dashboard', adminController.showDashboard);
router.get('/users', adminController.listUsers);
router.post('/users/:id/set-fee', isAdminApi, adminController.setFee);
router.post('/settings/default-fee', isAdminApi, adminController.setDefaultFee);

router.get('/coupons/create', adminController.showCreateCouponPage);
router.post('/coupons', adminController.createCoupon);

module.exports = router;
