const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Serviço para gerenciar notificações do fórum
 */
class NotificationService {
  
  /**
   * Notifica o autor quando alguém responde seu tópico
   */
  async notifyThreadReply(thread, post, replier) {
    try {
      // Não notificar se o autor está respondendo o próprio tópico
      if (thread.author.toString() === replier._id.toString()) {
        return;
      }

      await Notification.createNotification({
        recipient: thread.author,
        sender: replier._id,
        type: 'reply',
        title: 'Nova resposta no seu tópico',
        message: `${replier.username} respondeu ao seu tópico "${thread.title}"`,
        thread: thread._id,
        post: post._id,
        category: thread.category,
        link: `/forum/${thread.category.slug}/${thread.slug}#post-${post._id}`,
        icon: 'fa-comment',
        color: '#3b82f6'
      });
      
      logger.info(`Notificação de resposta criada para thread ${thread._id}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de resposta:', error);
    }
  }

  /**
   * Notifica quando alguém menciona um usuário com @username
   */
  async notifyMention(content, thread, post, mentioner) {
    try {
      // Extrair todas as menções @username do conteúdo
      const mentionRegex = /@(\w+)/g;
      const mentions = [...content.matchAll(mentionRegex)];
      
      if (mentions.length === 0) return;

      // Obter usernames únicos
      const uniqueUsernames = [...new Set(mentions.map(m => m[1]))];
      
      // Buscar usuários mencionados
      const mentionedUsers = await User.find({
        username: { $in: uniqueUsernames }
      }).select('_id username');

      // Criar notificação para cada usuário mencionado
      for (const mentionedUser of mentionedUsers) {
        // Não notificar se mencionou a si mesmo
        if (mentionedUser._id.toString() === mentioner._id.toString()) {
          continue;
        }

        await Notification.createNotification({
          recipient: mentionedUser._id,
          sender: mentioner._id,
          type: 'mention',
          title: 'Você foi mencionado',
          message: `${mentioner.username} mencionou você em "${thread.title}"`,
          thread: thread._id,
          post: post._id,
          category: thread.category,
          link: `/forum/${thread.category.slug}/${thread.slug}#post-${post._id}`,
          icon: 'fa-at',
          color: '#8b5cf6'
        });
      }
      
      logger.info(`${mentionedUsers.length} notificações de menção criadas`);
    } catch (error) {
      logger.error('Erro ao criar notificações de menção:', error);
    }
  }

  /**
   * Notifica quando alguém cita seu post
   */
  async notifyQuote(quotedPost, newPost, quoter) {
    try {
      // Não notificar se citou a si mesmo
      if (quotedPost.author.toString() === quoter._id.toString()) {
        return;
      }

      const thread = quotedPost.thread;

      await Notification.createNotification({
        recipient: quotedPost.author,
        sender: quoter._id,
        type: 'quote',
        title: 'Seu post foi citado',
        message: `${quoter.username} citou seu post em "${thread.title}"`,
        thread: thread._id,
        post: newPost._id,
        link: `/forum/${thread.category.slug}/${thread.slug}#post-${newPost._id}`,
        icon: 'fa-quote-left',
        color: '#10b981'
      });
      
      logger.info(`Notificação de citação criada`);
    } catch (error) {
      logger.error('Erro ao criar notificação de citação:', error);
    }
  }

  /**
   * Notifica quando um tópico é movido
   */
  async notifyThreadMoved(thread, oldCategory, newCategory, moderator) {
    try {
      await Notification.createNotification({
        recipient: thread.author,
        sender: moderator._id,
        type: 'thread_moved',
        title: 'Seu tópico foi movido',
        message: `Seu tópico "${thread.title}" foi movido de ${oldCategory.name} para ${newCategory.name}`,
        thread: thread._id,
        category: newCategory._id,
        link: `/forum/${newCategory.slug}/${thread.slug}`,
        icon: 'fa-exchange-alt',
        color: '#f59e0b'
      });
      
      logger.info(`Notificação de movimentação de tópico criada`);
    } catch (error) {
      logger.error('Erro ao criar notificação de movimentação:', error);
    }
  }

  /**
   * Notifica quando um tópico é travado
   */
  async notifyThreadLocked(thread, moderator, reason) {
    try {
      await Notification.createNotification({
        recipient: thread.author,
        sender: moderator._id,
        type: 'thread_locked',
        title: 'Seu tópico foi travado',
        message: `Seu tópico "${thread.title}" foi travado${reason ? ': ' + reason : ''}`,
        thread: thread._id,
        link: `/forum/${thread.category.slug}/${thread.slug}`,
        icon: 'fa-lock',
        color: '#ef4444'
      });
      
      logger.info(`Notificação de travamento de tópico criada`);
    } catch (error) {
      logger.error('Erro ao criar notificação de travamento:', error);
    }
  }

  /**
   * Notifica quando um tópico é fixado
   */
  async notifyThreadPinned(thread, moderator) {
    try {
      await Notification.createNotification({
        recipient: thread.author,
        sender: moderator._id,
        type: 'thread_pinned',
        title: 'Seu tópico foi fixado',
        message: `Seu tópico "${thread.title}" foi fixado! Ele agora aparece no topo da categoria.`,
        thread: thread._id,
        link: `/forum/${thread.category.slug}/${thread.slug}`,
        icon: 'fa-thumbtack',
        color: '#10b981'
      });
      
      logger.info(`Notificação de fixação de tópico criada`);
    } catch (error) {
      logger.error('Erro ao criar notificação de fixação:', error);
    }
  }

  /**
   * Notifica mudança na reputação
   */
  async notifyReputationChange(user, change, reason) {
    try {
      const isPositive = change > 0;
      
      await Notification.createNotification({
        recipient: user._id,
        sender: user._id, // Sistema
        type: 'reputation',
        title: isPositive ? 'Reputação aumentada!' : 'Reputação diminuída',
        message: `Sua reputação ${isPositive ? 'aumentou' : 'diminuiu'} em ${Math.abs(change)} pontos. ${reason}`,
        link: `/forum/user/${user.username}`,
        icon: isPositive ? 'fa-arrow-up' : 'fa-arrow-down',
        color: isPositive ? '#10b981' : '#ef4444',
        metadata: { change, reason }
      });
      
      logger.info(`Notificação de reputação criada para usuário ${user._id}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de reputação:', error);
    }
  }
}

module.exports = new NotificationService();
