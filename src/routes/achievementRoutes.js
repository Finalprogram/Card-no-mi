const express = require('express');
const router = express.Router();

// @route   GET /forum/achievements
// @desc    Página de conquistas do usuário
router.get('/achievements', (req, res) => {
  res.render('pages/maintenance', {
    title: 'Conquistas',
    pageTitle: 'Conquistas em Construção',
    message: 'Estamos reformulando o módulo de conquistas para trazer um sistema mais completo e estável.',
    backHref: '/forum'
  });
});

// @route   GET /forum/missions
// @desc    Página de missões diárias
router.get('/missions', (req, res) => {
  res.render('pages/maintenance', {
    title: 'Missões Diárias',
    pageTitle: 'Missões Diárias em Construção',
    message: 'As missões diárias estão passando por melhorias. Em breve voltam com novos desafios e recompensas.',
    backHref: '/forum'
  });
});

// @route   GET /api/forum/missions/today
// @desc    API para obter progresso das missões de hoje
router.get('/api/missions/today', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }

    const progress = await UserDailyProgress.getTodayProgress(req.session.user.id);

    res.json({
      success: true,
      progress
    });

  } catch (error) {
    console.error('Erro ao buscar missões:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar missões' });
  }
});

module.exports = router;
