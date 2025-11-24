const mongoose = require('mongoose');

const userReputationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Pontuação total
  totalPoints: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  title: {
    type: String,
    default: 'Novato'
  },
  // Estatísticas
  stats: {
    threadsCreated: {
      type: Number,
      default: 0
    },
    postsCreated: {
      type: Number,
      default: 0
    },
    reactionsReceived: {
      type: Number,
      default: 0
    },
    reactionsGiven: {
      type: Number,
      default: 0
    },
    bestAnswers: {
      type: Number,
      default: 0
    },
    helpfulVotes: {
      type: Number,
      default: 0
    }
  },
  // Badges/Conquistas
  badges: [{
    name: String,
    icon: String,
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Histórico de pontos
  pointsHistory: [{
    points: Number,
    reason: String,
    relatedThread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumThread'
    },
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumPost'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Preferências
  preferences: {
    notifyOnMention: {
      type: Boolean,
      default: true
    },
    notifyOnReply: {
      type: Boolean,
      default: true
    },
    notifyOnReaction: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: false
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
userReputationSchema.index({ user: 1 });
userReputationSchema.index({ totalPoints: -1 });
userReputationSchema.index({ level: -1 });

// Método para adicionar pontos
userReputationSchema.methods.addPoints = function(points, reason, relatedThread, relatedPost) {
  this.totalPoints += points;
  
  // Adicionar ao histórico
  this.pointsHistory.push({
    points,
    reason,
    relatedThread,
    relatedPost
  });
  
  // Calcular novo nível
  this.level = Math.floor(this.totalPoints / 100) + 1;
  
  // Atualizar título baseado no nível
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
};

// Método para adicionar badge
userReputationSchema.methods.addBadge = function(name, icon, description) {
  // Verificar se já tem o badge
  const hasBadge = this.badges.some(b => b.name === name);
  if (!hasBadge) {
    this.badges.push({ name, icon, description });
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para verificar e atribuir badges automáticos
userReputationSchema.methods.checkAndAwardBadges = async function() {
  const badges = [];
  
  // Badge de primeira thread
  if (this.stats.threadsCreated === 1) {
    badges.push({ name: 'Primeiro Tópico', icon: '🎯', description: 'Criou seu primeiro tópico' });
  }
  
  // Badge de 100 posts
  if (this.stats.postsCreated === 100) {
    badges.push({ name: 'Participativo', icon: '💬', description: 'Escreveu 100 posts' });
  }
  
  // Badge de 1000 posts
  if (this.stats.postsCreated === 1000) {
    badges.push({ name: 'Muito Ativo', icon: '🔥', description: 'Escreveu 1000 posts' });
  }
  
  // Badge de reações
  if (this.stats.reactionsReceived >= 100) {
    badges.push({ name: 'Popular', icon: '⭐', description: 'Recebeu 100 reações' });
  }
  
  // Badge de melhor resposta
  if (this.stats.bestAnswers >= 10) {
    badges.push({ name: 'Útil', icon: '✅', description: 'Teve 10 respostas marcadas como melhores' });
  }
  
  // Adicionar badges
  for (const badge of badges) {
    await this.addBadge(badge.name, badge.icon, badge.description);
  }
};

const UserReputation = mongoose.model('UserReputation', userReputationSchema);

module.exports = UserReputation;
