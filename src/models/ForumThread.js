const mongoose = require('mongoose');

const forumThreadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  inactivatedAt: Date,
  inactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  lastActivityBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Reações
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['like', 'love', 'wow', 'haha', 'sad', 'angry'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Integração com Marketplace
  linkedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing'
  },
  linkedCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card'
  },
  // Sistema de moderação
  moderationFlags: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderationStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },
  // Edição
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    previousContent: String
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
forumThreadSchema.index({ category: 1, isPinned: -1, lastActivity: -1 });
forumThreadSchema.index({ author: 1, createdAt: -1 });
forumThreadSchema.index({ slug: 1 });
forumThreadSchema.index({ tags: 1 });
forumThreadSchema.index({ isDeleted: 1, category: 1 });
forumThreadSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Virtual para contar posts
forumThreadSchema.virtual('postCount', {
  ref: 'ForumPost',
  localField: '_id',
  foreignField: 'thread',
  count: true
});

// Método para adicionar reação
forumThreadSchema.methods.addReaction = function(userId, reactionType) {
  // Remove reação anterior do usuário
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Adiciona nova reação
  this.reactions.push({
    user: userId,
    type: reactionType
  });
  
  return this.save();
};

// Método para remover reação
forumThreadSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Método para incrementar visualizações
forumThreadSchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this.save();
};

// Método para atualizar última atividade
forumThreadSchema.methods.updateLastActivity = function(userId) {
  this.lastActivity = new Date();
  this.lastActivityBy = userId;
  return this.save();
};

const ForumThread = mongoose.model('ForumThread', forumThreadSchema);

module.exports = ForumThread;
