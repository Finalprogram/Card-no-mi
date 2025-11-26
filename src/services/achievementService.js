const { Achievement, UserAchievement } = require('../models/Achievement');
const User = require('../models/User');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

class AchievementService {
  
  /**
   * Verifica e desbloqueia conquistas baseadas em estatísticas do usuário
   */
  async checkAchievements(userId, category = null) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Buscar conquistas relevantes
      const query = category ? { category } : {};
      const achievements = await Achievement.find(query);

      // Buscar conquistas já desbloqueadas
      const unlockedIds = await UserAchievement.find({ user: userId }).distinct('achievement');

      for (const achievement of achievements) {
        // Pular se já desbloqueou
        if (unlockedIds.includes(achievement._id.toString())) continue;

        const progress = await this.calculateProgress(userId, achievement);

        if (progress >= achievement.requirement) {
          await this.unlockAchievement(userId, achievement._id);
        }
      }
    } catch (error) {
      logger.error('Erro ao verificar conquistas:', error);
    }
  }

  /**
   * Calcula o progresso do usuário para uma conquista
   */
  async calculateProgress(userId, achievement) {
    const ForumThread = require('../models/ForumThread');
    const ForumPost = require('../models/ForumPost');
    const Reaction = require('../models/Reaction');

    try {
      switch (achievement.key) {
        // Conquistas de Posts
        case 'first_post':
          return await ForumPost.countDocuments({ author: userId });
        
        case 'posts_10':
        case 'posts_50':
        case 'posts_100':
        case 'posts_500':
        case 'posts_1000':
          return await ForumPost.countDocuments({ author: userId });

        // Conquistas de Threads
        case 'first_thread':
          return await ForumThread.countDocuments({ author: userId });
        
        case 'threads_10':
        case 'threads_25':
        case 'threads_50':
          return await ForumThread.countDocuments({ author: userId });

        // Conquistas de Reações
        case 'reactions_10':
        case 'reactions_50':
        case 'reactions_100':
          const posts = await ForumPost.find({ author: userId }).select('_id');
          const postIds = posts.map(p => p._id);
          return await Reaction.countDocuments({ post: { $in: postIds } });

        // Conquistas de Facção
        case 'faction_join':
          const user = await User.findById(userId);
          return user.faction ? 1 : 0;

        case 'faction_rank_5':
        case 'faction_rank_10':
          const userRank = await User.findById(userId).select('factionRank');
          return userRank.factionRank || 0;

        default:
          return 0;
      }
    } catch (error) {
      logger.error('Erro ao calcular progresso:', error);
      return 0;
    }
  }

  /**
   * Desbloqueia uma conquista para o usuário
   */
  async unlockAchievement(userId, achievementId) {
    try {
      const achievement = await Achievement.findById(achievementId);
      if (!achievement) return;

      // Criar registro de conquista
      await UserAchievement.create({
        user: userId,
        achievement: achievementId
      });

      // Adicionar pontos de recompensa
      if (achievement.rewardPoints > 0) {
        await User.findByIdAndUpdate(userId, {
          $inc: { factionPoints: achievement.rewardPoints }
        });
      }

      // Criar notificação
      await notificationService.notifyAchievement(userId, achievement);

      logger.info(`🏆 Conquista desbloqueada: ${achievement.name} para usuário ${userId}`);
    } catch (error) {
      logger.error('Erro ao desbloquear conquista:', error);
    }
  }

  /**
   * Busca conquistas do usuário
   */
  async getUserAchievements(userId) {
    return await UserAchievement.find({ user: userId })
      .populate('achievement')
      .sort({ unlockedAt: -1 });
  }

  /**
   * Busca todas as conquistas com status de progresso
   */
  async getAllAchievementsWithProgress(userId) {
    const achievements = await Achievement.find({ isHidden: false }).sort({ order: 1, requirement: 1 });
    const unlocked = await UserAchievement.find({ user: userId }).select('achievement unlockedAt');
    const unlockedMap = new Map(unlocked.map(u => [u.achievement.toString(), u.unlockedAt]));

    const result = [];
    for (const achievement of achievements) {
      const isUnlocked = unlockedMap.has(achievement._id.toString());
      const currentValue = isUnlocked ? achievement.requirement : await this.calculateProgress(userId, achievement);
      
      result.push({
        achievement: achievement.toObject(),
        currentValue,
        isUnlocked,
        unlockedAt: unlockedMap.get(achievement._id.toString()),
        progressPercentage: Math.min(100, Math.round((currentValue / achievement.requirement) * 100))
      });
    }

    return result;
  }
}

module.exports = new AchievementService();
