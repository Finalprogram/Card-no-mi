const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ForumPost = sequelize.define('ForumPost', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  threadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'forum_threads',
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
  parentPostId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_posts',
      key: 'id'
    }
  },
  depth: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  path: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  quotedPostId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_posts',
      key: 'id'
    }
  },
  quotedContent: {
    type: DataTypes.TEXT
  },
  mentions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  upvotes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  downvotes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
  moderationFlags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  attachments: {
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
  tableName: 'forum_posts',
  timestamps: true,
  indexes: [
    { fields: ['threadId', 'createdAt'] },
    { fields: ['threadId', 'path'] },
    { fields: ['authorId', 'createdAt'] },
    { fields: ['parentPostId'] },
    { fields: ['isDeleted', 'threadId'] },
    { fields: ['score', 'threadId'] }
  ]
});

Object.defineProperty(ForumPost.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = ForumPost;
