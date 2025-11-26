const express = require('express');
const router = express.Router();
const achievementService = require('../services/achievementService');
const { UserDailyProgress } = require('../models/DailyMission');

// @route   GET /forum/achievements
// @desc    Página de conquistas do usuário
router.get('/achievements', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const achievements = await achievementService.getAllAchievementsWithProgress(req.session.user.id);
    
    // Agrupar por categoria
    const grouped = {
      posts: achievements.filter(a => a.achievement.category === 'posts'),
      threads: achievements.filter(a => a.achievement.category === 'threads'),
      reactions: achievements.filter(a => a.achievement.category === 'reactions'),
      faction: achievements.filter(a => a.achievement.category === 'faction'),
      special: achievements.filter(a => a.achievement.category === 'special'),
      trading: achievements.filter(a => a.achievement.category === 'trading')
    };

    const totalAchievements = achievements.length;
    const unlockedAchievements = achievements.filter(a => a.isUnlocked).length;

    res.render('pages/forum/achievements', {
      user: req.session.user,
      pageTitle: 'Conquistas',
      achievements: grouped,
      totalAchievements,
      unlockedAchievements,
      progress: Math.round((unlockedAchievements / totalAchievements) * 100)
    });

  } catch (error) {
    console.error('Erro ao buscar conquistas:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// @route   GET /forum/missions
// @desc    Página de missões diárias
router.get('/missions', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const progress = await UserDailyProgress.getTodayProgress(req.session.user.id);

    res.render('pages/forum/missions', {
      user: req.session.user,
      pageTitle: 'Missões Diárias',
      progress
    });

  } catch (error) {
    console.error('Erro ao buscar missões:', error);
    res.status(500).send('Erro interno do servidor');
  }
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
