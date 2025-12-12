const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ForumThread = sequelize.define('ForumThread', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 200]
    }
  },
  type: {
    type: DataTypes.ENUM('duvida', 'anuncio', 'discussao', 'tutorial', 'outro'),
    allowNull: false,
    defaultValue: 'discussao'
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'forum_categories',
      key: 'id'
    }
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 50000]
    }
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  isPinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  inactivatedAt: {
    type: DataTypes.DATE
  },
  inactivatedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedAt: {
    type: DataTypes.DATE
  },
  deletedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  lastActivityById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reactions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  linkedListingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'listings',
      key: 'id'
    }
  },
  linkedCardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cards',
      key: 'id'
    }
  },
  moderationFlags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  moderationStatus: {
    type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'),
    defaultValue: 'none'
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  editedAt: {
    type: DataTypes.DATE
  },
  editHistory: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
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
  tableName: 'forum_threads',
  timestamps: true,
  indexes: [
    { fields: ['categoryId', 'isPinned', 'lastActivity'] },
    { fields: ['authorId', 'createdAt'] },
    { fields: ['slug'] },
    { fields: ['isDeleted', 'categoryId'] }
  ]
});

module.exports = ForumThread;
