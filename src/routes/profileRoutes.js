const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const avatarUpload = require('../middleware/avatarUpload');

// Rotas de perfil
router.get('/user/:username', profileController.getUserProfile);
router.get('/profile/edit', profileController.getEditProfile);
router.post('/profile/edit', profileController.updateProfile);
router.post('/profile/avatar', avatarUpload.single('avatar'), profileController.uploadAvatar);

module.exports = router;
