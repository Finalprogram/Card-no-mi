const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { isAuthPage } = require('../middleware/auth');

// Rota para exibir a página de registro
router.get('/register', authController.showRegisterPage);

// Rota para receber os dados do formulário de registro
router.post('/register', authController.registerUser);

// Rota para verificação de email
router.get('/verify-email', authController.verifyEmail);

// --- NOVAS ROTAS DE LOGIN ---
// Rota para exibir a página de login
router.get('/login', authController.showLoginPage);

// Rota para receber os dados do formulário de login
router.post('/login', authController.loginUser);
router.get('/logout', authController.logoutUser);

// Rota para atualizar o endereço do perfil
router.post('/profile/update', isAuthPage, authController.updateAddress);

module.exports = router;