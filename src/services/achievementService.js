const { Achievement, UserAchievement } = require('../models/Achievement');
const User = require('../models/User');
const notificationService = require('./notificationService');
const logger = require('../config/logger');
const { Op } = require('sequelize');

class AchievementService {
  
  /**
   * Verifica e desbloqueia conquistas baseadas em estatísticas do usuário
   */
  async checkAchievements(userId, category = null) {
    try {
      const user = await User.findByPk(userId);
      if (!user) return;

      // Buscar conquistas relevantes
      const query = category ? { category } : {};
      const achievements = await Achievement.findAll({ where: query });

      // Buscar conquistas já desbloqueadas
      const unlockedRows = await UserAchievement.findAll({
        where: { userId },
        attributes: ['achievementId']
      });
      const unlockedIds = unlockedRows.map(row => row.achievementId.toString());

      for (const achievement of achievements) {
        // Pular se já desbloqueou
        if (unlockedIds.includes(achievement.id.toString())) continue;

        const progress = await this.calculateProgress(userId, achievement);

        if (progress >= achievement.requirement) {
          await this.unlockAchievement(userId, achievement.id);
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
          return await ForumPost.count({ where: { authorId: userId } });
        
        case 'posts_10':
        case 'posts_50':
        case 'posts_100':
        case 'posts_500':
        case 'posts_1000':
          return await ForumPost.count({ where: { authorId: userId } });

        // Conquistas de Threads
        case 'first_thread':
          return await ForumThread.count({ where: { authorId: userId } });
        
        case 'threads_10':
        case 'threads_25':
        case 'threads_50':
          return await ForumThread.count({ where: { authorId: userId } });

        // Conquistas de Reações
        case 'reactions_10':
        case 'reactions_50':
        case 'reactions_100':
          const posts = await ForumPost.findAll({ where: { authorId: userId }, attributes: ['id'] });
          const postIds = posts.map(p => p.id);
          return await Reaction.count({ where: { postId: { [Op.in]: postIds } } });

        // Conquistas de Facção
        case 'faction_join':
          const user = await User.findByPk(userId);
          return user.faction ? 1 : 0;

        case 'faction_rank_5':
        case 'faction_rank_10':
          const userRank = await User.findByPk(userId, { attributes: ['factionRank'] });
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
      const achievement = await Achievement.findByPk(achievementId);
      if (!achievement) return;

      // Criar registro de conquista
      await UserAchievement.create({
        userId: userId,
        achievementId: achievementId
      });

      // Adicionar pontos de recompensa
      if (achievement.rewardPoints > 0) {
        await User.update(
          { factionPoints: User.sequelize.literal(`factionPoints + ${achievement.rewardPoints}`) },
          { where: { id: userId } }
        );
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
    return await UserAchievement.findAll({
      where: { userId },
      include: [{ model: Achievement, as: 'achievement' }],
      order: [['unlockedAt', 'DESC']]
    });
  }

  /**
   * Busca todas as conquistas com status de progresso
   */
  async getAllAchievementsWithProgress(userId) {
    const achievements = await Achievement.findAll({
      where: { isHidden: false },
      order: [['order', 'ASC'], ['requirement', 'ASC']]
    });
    const unlocked = await UserAchievement.findAll({
      where: { userId },
      attributes: ['achievementId', 'unlockedAt']
    });
    const unlockedMap = new Map(unlocked.map(u => [u.achievementId.toString(), u.unlockedAt]));

    const result = [];
    for (const achievement of achievements) {
      const isUnlocked = unlockedMap.has(achievement.id.toString());
      const currentValue = isUnlocked ? achievement.requirement : await this.calculateProgress(userId, achievement);
      
      result.push({
        achievement: achievement.toJSON(),
        currentValue,
        isUnlocked,
        unlockedAt: unlockedMap.get(achievement.id.toString()),
        progressPercentage: Math.min(100, Math.round((currentValue / achievement.requirement) * 100))
      });
    }

    return result;
  }
}

module.exports = new AchievementService();
