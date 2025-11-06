// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { isAuthApi } = require('../middleware/auth');

/**
 * @fileoverview Rotas para gerenciar o carrinho de compras.
 * @requires express
 * @requires ../controllers/cartController
 * @requires ../middleware/auth
 */

// Aplica o middleware de autenticação a todas as rotas do carrinho
router.use(isAuthApi);

/**
 * Rota para exibir o conteúdo do carrinho.
 * @name GET /cart/
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.get('/', cartController.show);

/**
 * Rota para adicionar um item ao carrinho.
 * @name POST /cart/add
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.post('/add', cartController.add);

/**
 * Rota para atualizar a quantidade de um item no carrinho.
 * @name POST /cart/update
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.post('/update', cartController.update);

/**
 * Rota para remover um item do carrinho.
 * @name POST /cart/remove
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.post('/remove', cartController.remove);

/**
 * Rota para limpar todos os itens do carrinho.
 * @name POST /cart/clear
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.post('/clear', cartController.clear);

/**
 * Rota para obter o conteúdo do carrinho em formato JSON.
 * @name GET /cart/json
 * @function
 * @memberof module:routes/cartRoutes
 * @inner
 */
router.get('/json', cartController.json);

module.exports = router;
