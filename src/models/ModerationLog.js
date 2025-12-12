const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ModerationLog = sequelize.define('ModerationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  actionType: {
    type: DataTypes.ENUM(
      'thread_flagged',
      'post_flagged',
      'thread_flags_dismissed',
      'post_flags_dismissed',
      'thread_deleted',
      'post_deleted',
      'thread_locked',
      'thread_unlocked',
      'thread_pinned',
      'thread_unpinned',
      'thread_inactivated',
      'thread_activated',
      'post_inactivated',
      'post_activated'
    ),
    allowNull: false
  },
  targetType: {
    type: DataTypes.ENUM('thread', 'post'),
    allowNull: false
  },
  targetId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  targetTitle: {
    type: DataTypes.STRING
  },
  targetContent: {
    type: DataTypes.TEXT
  },
  moderatorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  moderatorUsername: {
    type: DataTypes.STRING
  },
  targetUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  targetUsername: {
    type: DataTypes.STRING
  },
  reporterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reporterUsername: {
    type: DataTypes.STRING
  },
  reportReason: {
    type: DataTypes.STRING
  },
  details: {
    type: DataTypes.STRING(500)
  },
  archivedFlags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  ipAddress: {
    type: DataTypes.STRING
  },
  userAgent: {
    type: DataTypes.STRING
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'moderation_logs',
  timestamps: true,
  indexes: [
    { fields: ['actionType', 'createdAt'] },
    { fields: ['moderatorId', 'createdAt'] },
    { fields: ['targetUserId', 'createdAt'] },
    { fields: ['targetId', 'targetType'] }
  ]
});

module.exports = ModerationLog;
