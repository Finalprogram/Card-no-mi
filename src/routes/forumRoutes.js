const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');

// ============================================================================
// ROTAS PÚBLICAS
// ============================================================================

// Index do fórum (todas as categorias)
router.get('/', forumController.getForumIndex);

// Painel de moderação (apenas para moderadores/admins) - deve vir antes da rota dinâmica de categoria
router.get('/moderation', forumController.getModerationEntry);

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

// Votar em post (upvote/downvote estilo Reddit)
router.post('/post/:postId/vote', forumController.votePost);

// Reagir a thread
router.post('/thread/:threadId/react', forumController.reactToThread);

// ============================================================================
// ROTAS DE MODERAÇÃO
// ============================================================================

// Fixar/Desfixar thread
router.post('/moderation/thread/:threadId/pin', forumController.pinThread);

// Bloquear/Desbloquear thread
router.post('/moderation/thread/:threadId/lock', forumController.lockThread);

// Deletar thread
router.delete('/moderation/thread/:threadId', forumController.deleteThread);

// Deletar post
router.delete('/moderation/post/:postId', forumController.deletePost);

// Flag thread
router.post('/moderation/thread/:threadId/flag', forumController.flagThread);

// Flag post
router.post('/moderation/post/:postId/flag', forumController.flagPost);

// Dismiss flags thread
router.post('/moderation/thread/:threadId/dismiss-flags', forumController.dismissThreadFlags);

// Dismiss flags post
router.post('/moderation/post/:postId/dismiss-flags', forumController.dismissPostFlags);

module.exports = router;
