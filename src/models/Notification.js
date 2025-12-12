const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recipientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM(
      'reply',
      'mention',
      'quote',
      'pm',
      'thread_moved',
      'thread_locked',
      'thread_pinned',
      'post_liked',
      'badge_earned',
      'reputation',
      'sale',
      'order_status'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  threadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_threads',
      key: 'id'
    }
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_posts',
      key: 'id'
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_categories',
      key: 'id'
    }
  },
  link: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'fa-bell'
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#3b82f6'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  expiresAt: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['recipientId', 'isRead', 'createdAt'] },
    { fields: ['recipientId', 'type'] },
    { fields: ['expiresAt'] }
  ]
});

module.exports = Notification;
