const express = require('express');
const router = express.Router();
const Reaction = require('../models/Reaction');
const ForumPost = require('../models/ForumPost');
const { UserDailyProgress } = require('../models/DailyMission');

// @route   POST /api/forum/reactions
// @desc    Adicionar/remover reação em um post
router.post('/reactions', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }

    const { postId, emoji } = req.body;
    const userId = req.session.user.id;

    // Verificar se o post existe
    const post = await ForumPost.findByPk(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post não encontrado' });
    }

    // Toggle reação
    const result = await Reaction.toggleReaction(postId, userId, emoji);

    // Incrementar progresso da missão diária
    if (result.action === 'added') {
      await UserDailyProgress.incrementProgress(userId, 'give_reaction');
    }

    // Buscar contagem atualizada
    const reactions = await Reaction.getReactionCounts(postId);
    const userReactions = await Reaction.getUserReactions(postId, userId);

    res.json({
      success: true,
      action: result.action,
      reactions,
      userReactions
    });

  } catch (error) {
    console.error('Erro ao processar reação:', error);
    res.status(500).json({ success: false, message: 'Erro ao processar reação' });
  }
});

// @route   GET /api/forum/reactions/:postId
// @desc    Obter reações de um post
router.get('/reactions/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.session.user?.id;

    const reactions = await Reaction.getReactionCounts(postId);
    const userReactions = userId ? await Reaction.getUserReactions(postId, userId) : [];

    res.json({
      success: true,
      reactions,
      userReactions
    });

  } catch (error) {
    console.error('Erro ao buscar reações:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar reações' });
  }
});

module.exports = router;
