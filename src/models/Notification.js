const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  type: {
    type: String,
    enum: [
      'reply',           // Alguém respondeu ao seu tópico
      'mention',         // Alguém mencionou você com @username
      'quote',           // Alguém citou seu post
      'pm',              // Nova mensagem privada (futuro)
      'thread_moved',    // Seu tópico foi movido
      'thread_locked',   // Seu tópico foi travado
      'thread_pinned',   // Seu tópico foi fixado
      'post_liked',      // Alguém curtiu seu post (futuro)
      'badge_earned',    // Você ganhou um badge (futuro)
      'reputation',      // Mudança na reputação
      'sale',            // Você vendeu uma carta
      'order_status'     // Status do seu pedido mudou
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Referências aos objetos relacionados
  thread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread'
  },
  
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory'
  },
  
  // Link direto para onde a notificação deve levar
  link: {
    type: String,
    required: true
  },
  
  // Status da notificação
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  
  readAt: {
    type: Date
  },
  
  // Ícone para exibir na notificação
  icon: {
    type: String,
    default: 'fa-bell'
  },
  
  // Cor para destacar a notificação (opcional)
  color: {
    type: String,
    default: '#3b82f6'
  },
  
  // Metadados adicionais (JSON livre)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
  }
});

// Índice composto para consultas eficientes
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1 });

// TTL Index - Remove notificações antigas automaticamente
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Métodos estáticos
NotificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = new this(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    throw error;
  }
};

NotificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

NotificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

NotificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

NotificationSchema.statics.getUserNotifications = async function(userId, limit = 20, skip = 0) {
  return this.find({ recipient: userId })
    .populate('sender', 'username avatar role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

module.exports = mongoose.model('Notification', NotificationSchema);
