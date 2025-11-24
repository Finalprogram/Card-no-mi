const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');

// ============================================================================
// ROTAS PÚBLICAS
// ============================================================================

// Index do fórum (todas as categorias)
router.get('/', forumController.getForumIndex);

// Busca
router.get('/search', forumController.searchForum);

// Perfil de usuário no fórum
router.get('/user/:username', forumController.getUserProfile);

// ============================================================================
// ROTAS PRIVADAS (Requerem autenticação)
// ============================================================================
// IMPORTANTE: Rotas específicas (com /new) DEVEM vir antes das rotas com parâmetros dinâmicos

// Mostrar formulário de criar thread
router.get('/:categorySlug/new', forumController.showCreateThreadForm);

// Criar nova thread
router.post('/:categorySlug/new', forumController.createThread);

// ============================================================================
// ROTAS PÚBLICAS (com parâmetros dinâmicos)
// ============================================================================

// Threads de uma categoria
router.get('/:categorySlug', forumController.getCategoryThreads);

// Visualizar thread específica
router.get('/:categorySlug/:threadSlug', forumController.getThread);

// Criar post/resposta
router.post('/:categorySlug/:threadSlug/reply', forumController.createPost);

// Reagir a thread
router.post('/thread/:threadId/react', forumController.reactToThread);

// Reagir a post
router.post('/post/:postId/react', forumController.reactToPost);

// ============================================================================
// ROTAS DE MODERAÇÃO (Futuro)
// ============================================================================

// Editar thread
// router.put('/thread/:threadId', forumController.editThread);

// Deletar thread
// router.delete('/thread/:threadId', forumController.deleteThread);

// Fixar/Desfixar thread
// router.post('/thread/:threadId/pin', forumController.pinThread);

// Bloquear/Desbloquear thread
// router.post('/thread/:threadId/lock', forumController.lockThread);

// Editar post
// router.put('/post/:postId', forumController.editPost);

// Deletar post
// router.delete('/post/:postId', forumController.deletePost);

module.exports = router;
