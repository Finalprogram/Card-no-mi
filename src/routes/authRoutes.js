const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');
const { isAuthPage } = require('../middleware/auth');

/**
 * @fileoverview Rotas para autenticação e gerenciamento de usuários.
 * @requires express
 * @requires ../controllers/authController
 * @requires ../middleware/upload
 * @requires ../middleware/auth
 */

/**
 * Rota para exibir a página de registro.
 * @name GET /auth/register
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.get('/register', authController.showRegisterPage);

/**
 * Rota para registrar um novo usuário.
 * @name POST /auth/register
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.post('/register', authController.registerUser);

/**
 * Rota para verificar o email de um usuário.
 * @name GET /auth/verify-email
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * Rota para exibir a página de login.
 * @name GET /auth/login
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.get('/login', authController.showLoginPage);

/**
 * Rota para autenticar um usuário.
 * @name POST /auth/login
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.post('/login', authController.loginUser);

/**
 * Rota para fazer logout de um usuário.
 * @name GET /auth/logout
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.get('/logout', authController.logoutUser);

/**
 * Rota para atualizar o perfil de um usuário.
 * @name POST /auth/profile/update
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.post('/profile/update', isAuthPage, authController.updateProfile);

/**
 * Rota para atualizar o avatar de um usuário.
 * @name POST /auth/profile/avatar
 * @function
 * @memberof module:routes/authRoutes
 * @inner
 */
router.post('/profile/avatar', isAuthPage, upload, authController.updateAvatar);

module.exports = router;