const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../database/connection');
const User = require('./User');
const ForumThread = require('./ForumThread');
const ForumPost = require('./ForumPost');

class UserReputation extends Model {
  async addPoints(points, reason, relatedThreadId, relatedPostId) {
    this.totalPoints += points;

    const history = this.pointsHistory || [];
    history.push({
      points,
      reason,
      relatedThreadId,
      relatedPostId,
      createdAt: new Date()
    });
    this.pointsHistory = history;

    this.level = Math.floor(this.totalPoints / 100) + 1;

    if (this.level >= 50) {
      this.title = 'Lenda';
    } else if (this.level >= 30) {
      this.title = 'Mestre';
    } else if (this.level >= 20) {
      this.title = 'Veterano';
    } else if (this.level >= 10) {
      this.title = 'Experiente';
    } else if (this.level >= 5) {
      this.title = 'Intermediário';
    } else {
      this.title = 'Novato';
    }

    return this.save();
  }

  async addBadge(name, icon, description) {
    const currentBadges = this.badges || [];
    const hasBadge = currentBadges.some(b => b.name === name);
    if (!hasBadge) {
      currentBadges.push({ name, icon, description, earnedAt: new Date() });
      this.badges = currentBadges;
      return this.save();
    }
    return Promise.resolve(this);
  }

  async checkAndAwardBadges() {
    const badges = [];

    if (this.stats.threadsCreated === 1) {
      badges.push({ name: 'Primeiro Tópico', icon: '🎯', description: 'Criou seu primeiro tópico' });
    }
    if (this.stats.postsCreated === 100) {
      badges.push({ name: 'Participativo', icon: '💬', description: 'Escreveu 100 posts' });
    }
    if (this.stats.postsCreated === 1000) {
      badges.push({ name: 'Muito Ativo', icon: '🔥', description: 'Escreveu 1000 posts' });
    }
    if (this.stats.reactionsReceived >= 100) {
      badges.push({ name: 'Popular', icon: '⭐', description: 'Recebeu 100 reações' });
    }
    if (this.stats.bestAnswers >= 10) {
      badges.push({ name: 'Útil', icon: '✅', description: 'Teve 10 respostas marcadas como melhores' });
    }

    for (const badge of badges) {
      await this.addBadge(badge.name, badge.icon, badge.description);
    }
  }
}

UserReputation.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  totalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: 'Novato'
  },
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      threadsCreated: 0,
      postsCreated: 0,
      reactionsReceived: 0,
      reactionsGiven: 0,
      bestAnswers: 0,
      helpfulVotes: 0
    }
  },
  badges: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  pointsHistory: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {
      notifyOnMention: true,
      notifyOnReply: true,
      notifyOnReaction: true,
      emailNotifications: false
    }
  }
}, {
  sequelize,
  modelName: 'UserReputation',
  tableName: 'user_reputations',
  timestamps: true
});

UserReputation.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = UserReputation;