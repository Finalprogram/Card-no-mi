const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');
const { Op } = require('sequelize');

function getId(value) {
  if (value && value.id != null) return value.id;
  if (value && value._id != null) return value._id;
  return value;
}

/**
 * Serviço para gerenciar notificações do fórum
 */
class NotificationService {
  
  /**
   * Notifica o autor quando alguém responde seu tópico
   */
  async notifyThreadReply(thread, post, replier) {
    try {
      console.log('🔔 notifyThreadReply chamado:', {
        threadAuthor: thread.author,
        replierId: getId(replier),
        threadId: getId(thread)
      });

      // Extrair ID do autor (pode estar populado ou não)
      const threadAuthorId = getId(thread.author);
      
      // Não notificar se o autor está respondendo o próprio tópico
      if (threadAuthorId.toString() === getId(replier).toString()) {
        console.log('⚠️ Não notificando: autor respondendo próprio tópico');
        return;
      }

      // Extrair dados da categoria (pode estar populada ou não)
      const categorySlug = thread.category?.slug || thread.category;
      const categoryId = getId(thread.category);

      console.log('📧 Criando notificação de resposta...');
      await Notification.createNotification({
        recipient: threadAuthorId,
        sender: getId(replier),
        type: 'reply',
        title: 'Nova resposta no seu tópico',
        message: `${replier.username} respondeu ao seu tópico "${thread.title}"`,
        thread: getId(thread),
        post: getId(post),
        category: categoryId,
        link: `/forum/${categorySlug}/${thread.slug}#post-${getId(post)}`,
        icon: 'fa-comment',
        color: '#3b82f6'
      });
      
      console.log(`✅ Notificação de resposta criada para thread ${getId(thread)}`);
    } catch (error) {
      console.error('❌ Erro ao criar notificação de resposta:', error);
      logger.error('Erro ao criar notificação de resposta:', error);
    }
  }

  /**
   * Notifica quando alguém menciona um usuário com @username
   */
  async notifyMention(content, thread, post, mentioner) {
    try {
      console.log('🔔 notifyMention chamado');
      // Extrair todas as menções @username do conteúdo
      const mentionRegex = /@(\w+)/g;
      const mentions = [...content.matchAll(mentionRegex)];
      
      if (mentions.length === 0) {
        console.log('⚠️ Nenhuma menção encontrada');
        return;
      }

      // Obter usernames únicos
      const uniqueUsernames = [...new Set(mentions.map(m => m[1]))];
      console.log('📧 Usernames mencionados:', uniqueUsernames);
      
      // Buscar usuários mencionados
      const mentionedUsers = await User.findAll({
        where: { username: { [Op.in]: uniqueUsernames } },
        attributes: ['id', 'username']
      });

      // Extrair dados da categoria
      const categorySlug = thread.category?.slug || thread.category;
      const categoryId = getId(thread.category);

      // Criar notificação para cada usuário mencionado
      for (const mentionedUser of mentionedUsers) {
        // Não notificar se mencionou a si mesmo
        if (getId(mentionedUser).toString() === getId(mentioner).toString()) {
          continue;
        }

        await Notification.createNotification({
          recipient: getId(mentionedUser),
          sender: getId(mentioner),
          type: 'mention',
          title: 'Você foi mencionado',
          message: `${mentioner.username} mencionou você em "${thread.title}"`,
          thread: getId(thread),
          post: getId(post),
          category: categoryId,
          link: `/forum/${categorySlug}/${thread.slug}#post-${getId(post)}`,
          icon: 'fa-at',
          color: '#8b5cf6'
        });
      }
      
      console.log(`✅ ${mentionedUsers.length} notificações de menção criadas`);
    } catch (error) {
      console.error('❌ Erro ao criar notificações de menção:', error);
      logger.error('Erro ao criar notificações de menção:', error);
    }
  }

  /**
   * Notifica quando alguém cita seu post
   */
  async notifyQuote(quotedPost, newPost, quoter) {
    try {
      // Não notificar se citou a si mesmo
      if (getId(quotedPost.author).toString() === getId(quoter).toString()) {
        return;
      }

      const thread = quotedPost.thread;

      await Notification.createNotification({
        recipient: quotedPost.author,
        sender: getId(quoter),
        type: 'quote',
        title: 'Seu post foi citado',
        message: `${quoter.username} citou seu post em "${thread.title}"`,
        thread: getId(thread),
        post: getId(newPost),
        link: `/forum/${thread.category.slug}/${thread.slug}#post-${getId(newPost)}`,
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
        sender: getId(moderator),
        type: 'thread_moved',
        title: 'Seu tópico foi movido',
        message: `Seu tópico "${thread.title}" foi movido de ${oldCategory.name} para ${newCategory.name}`,
        thread: getId(thread),
        category: getId(newCategory),
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
        sender: getId(moderator),
        type: 'thread_locked',
        title: 'Seu tópico foi travado',
        message: `Seu tópico "${thread.title}" foi travado${reason ? ': ' + reason : ''}`,
        thread: getId(thread),
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
        sender: getId(moderator),
        type: 'thread_pinned',
        title: 'Seu tópico foi fixado',
        message: `Seu tópico "${thread.title}" foi fixado! Ele agora aparece no topo da categoria.`,
        thread: getId(thread),
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
        recipient: getId(user),
        sender: getId(user), // Sistema
        type: 'reputation',
        title: isPositive ? 'Reputação aumentada!' : 'Reputação diminuída',
        message: `Sua reputação ${isPositive ? 'aumentou' : 'diminuiu'} em ${Math.abs(change)} pontos. ${reason}`,
        link: `/forum/user/${user.username}`,
        icon: isPositive ? 'fa-arrow-up' : 'fa-arrow-down',
        color: isPositive ? '#10b981' : '#ef4444',
        metadata: { change, reason }
      });
      
      logger.info(`Notificação de reputação criada para usuário ${getId(user)}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de reputação:', error);
    }
  }

  /**
   * Notifica o vendedor quando uma venda é concluída
   */
  async notifySale(sellerId, buyerUsername, cardName, quantity, price, orderId) {
    try {
      await Notification.createNotification({
        recipient: sellerId,
        sender: sellerId, // Sistema
        type: 'sale',
        title: '💰 Você fez uma venda!',
        message: `${buyerUsername} comprou ${quantity}x ${cardName} por R$ ${price.toFixed(2)}`,
        icon: 'fa-shopping-cart',
        color: '#10b981',
        link: `/meus-pedidos-vendidos?order=${orderId}`,
      });
      logger.info(`📧 Notificação de venda criada para vendedor ${sellerId}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de venda:', error);
    }
  }

  /**
   * Notifica quando o usuário desbloqueia uma conquista
   */
  async notifyAchievement(userId, achievement) {
    try {
      await Notification.createNotification({
        recipient: userId,
        sender: userId, // Sistema
        type: 'badge_earned',
        title: `🏆 Conquista desbloqueada!`,
        message: `Você desbloqueou: ${achievement.name}`,
        icon: achievement.icon || 'fa-trophy',
        color: '#FFB800',
        link: `/forum/achievements`,
        metadata: { achievementId: getId(achievement) }
      });
      
      logger.info(`🏆 Notificação de conquista criada para usuário ${userId}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de conquista:', error);
    }
  }

  /**
   * Notifica o comprador quando o status do pedido muda
   */
  async notifyOrderStatus(buyerId, orderId, newStatus) {
    try {
      const statusMessages = {
        'Paid': {
          title: '✅ Pagamento confirmado!',
          message: 'Seu pedido foi confirmado e está sendo preparado para envio.',
          color: '#10b981',
          icon: 'fa-check-circle'
        },
        'Shipped': {
          title: '📦 Pedido enviado!',
          message: 'Seu pedido foi enviado e está a caminho.',
          color: '#3b82f6',
          icon: 'fa-shipping-fast'
        },
        'Delivered': {
          title: '🎉 Pedido entregue!',
          message: 'Seu pedido foi entregue. Aproveite suas cartas!',
          color: '#10b981',
          icon: 'fa-check-circle'
        },
        'Cancelled': {
          title: '❌ Pedido cancelado',
          message: 'Seu pedido foi cancelado.',
          color: '#ef4444',
          icon: 'fa-times-circle'
        },
        'PendingPayment': {
          title: '⏳ Aguardando pagamento',
          message: 'Estamos aguardando a confirmação do seu pagamento.',
          color: '#f59e0b',
          icon: 'fa-clock'
        }
      };

      const statusInfo = statusMessages[newStatus] || {
        title: '📋 Status do pedido atualizado',
        message: `Status do seu pedido foi atualizado para: ${newStatus}`,
        color: '#6b7280',
        icon: 'fa-info-circle'
      };

      await Notification.createNotification({
        recipient: buyerId,
        sender: buyerId, // Sistema
        type: 'order_status',
        title: statusInfo.title,
        message: statusInfo.message,
        icon: statusInfo.icon,
        color: statusInfo.color,
        link: `/meus-pedidos?order=${orderId}`,
      });
      
      logger.info(`📧 Notificação de status de pedido criada para comprador ${buyerId}: ${newStatus}`);
    } catch (error) {
      logger.error('Erro ao criar notificação de status de pedido:', error);
    }
  }
}

module.exports = new NotificationService();
