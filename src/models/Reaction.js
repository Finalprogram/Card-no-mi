const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User');
const ForumPost = require('./ForumPost');

class Reaction extends Model {
  static async toggleReaction(postId, userId, emoji) {
    const existing = await this.findOne({ where: { postId, userId, emoji } });

    if (existing) {
      await existing.destroy();
      return { action: 'removed', reaction: null };
    } else {
      const reaction = await this.create({ postId, userId, emoji });
      return { action: 'added', reaction };
    }
  }

  static async getReactionCounts(postId) {
    return this.findAll({
      attributes: ['emoji', [sequelize.fn('COUNT', sequelize.col('emoji')), 'count']],
      where: { postId },
      group: ['emoji']
    });
  }

  static async getUserReactions(postId, userId) {
    const reactions = await this.findAll({
      attributes: ['emoji'],
      where: { postId, userId }
    });
    return reactions.map(r => r.emoji);
  }
}

Reaction.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'forum_posts',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  emoji: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['👍', '👎', '❤️', '😂', '🔥', '👀', '🎉', '😮']]
    }
  }
}, {
  sequelize,
  modelName: 'Reaction',
  tableName: 'reactions',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['postId', 'userId', 'emoji']
    }
  ]
});

Reaction.belongsTo(ForumPost, { as: 'post', foreignKey: 'postId' });
Reaction.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = Reaction;