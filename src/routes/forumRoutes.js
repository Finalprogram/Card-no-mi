const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const forumUpload = require('../middleware/forumUpload');

// ============================================================================
// ROTAS PÚBLICAS
// ============================================================================

// Index do fórum (todas as categorias)
router.get('/', forumController.getForumIndex);

// ============================================================================
// SISTEMA DE FACÇÃO
// ============================================================================

// Tela de escolha de facção
router.get('/faction/choose', forumController.getFactionChoice);

// Processar escolha de facção
router.post('/faction/choose', forumController.postFactionChoice);

// Painel de moderação (apenas para moderadores/admins) - deve vir antes da rota dinâmica de categoria
router.get('/moderation', forumController.getModerationDashboard);

// Histórico de moderação
router.get('/moderation/history', forumController.getModerationHistory);

// Busca
router.get('/search', forumController.searchForum);

// Perfil de usuário no fórum
router.get('/user/:username', forumController.getUserProfile);

// Leaderboard de facções
router.get('/leaderboard', forumController.getLeaderboard);

// ============================================================================
// ROTAS PRIVADAS (Requerem autenticação)
// ============================================================================
// IMPORTANTE: Rotas específicas (com /new) DEVEM vir antes das rotas com parâmetros dinâmicos

// Mostrar formulário de criar thread
router.get('/:categorySlug/new', forumController.showCreateThreadForm);

// Criar nova thread (com upload de imagens)
router.post('/:categorySlug/new', forumUpload.array('images', 5), forumController.createThread);

// ============================================================================
// ROTAS PÚBLICAS (com parâmetros dinâmicos)
// ============================================================================

// Threads de uma categoria
router.get('/:categorySlug', forumController.getCategoryThreads);

// Visualizar thread específica
router.get('/:categorySlug/:threadSlug', forumController.getThread);

// Criar post/resposta (com upload de imagens)
router.post('/:categorySlug/:threadSlug/reply', forumUpload.array('images', 5), forumController.createPost);

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

// Toggle thread active status
router.post('/moderation/thread/:threadId/toggle-active', forumController.toggleThreadActive);

// Toggle post active status
router.post('/moderation/post/:postId/toggle-active', forumController.togglePostActive);

module.exports = router;
