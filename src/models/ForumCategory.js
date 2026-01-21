const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ForumCategory = sequelize.define('ForumCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: '💬'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#A259FF'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  parentCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'forum_categories',
      key: 'id'
    }
  },
  isSubforum: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  showInHome: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      canView: ['guest', 'user', 'moderator', 'admin'],
      canPost: ['user', 'moderator', 'admin'],
      canModerate: ['moderator', 'admin']
    }
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
  tableName: 'forum_categories',
  timestamps: true,
  indexes: [
    { fields: ['slug'] },
    { fields: ['order'] },
    { fields: ['isActive'] },
    { fields: ['parentCategoryId'] },
    { fields: ['isSubforum'] }
  ]
});

Object.defineProperty(ForumCategory.prototype, '_id', {
  get() {
    return this.id;
  }
});

module.exports = ForumCategory;
