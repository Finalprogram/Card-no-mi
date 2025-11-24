const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
  thread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
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
  // Resposta a outro post (threading)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  // Citação de outro post
  quotedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  quotedContent: String,
  // Menções
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
  // Status
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
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
  }],
  // Moderação
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
  // Anexos (futuro: imagens)
  attachments: [{
    type: String
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
forumPostSchema.index({ thread: 1, createdAt: 1 });
forumPostSchema.index({ author: 1, createdAt: -1 });
forumPostSchema.index({ replyTo: 1 });
forumPostSchema.index({ mentions: 1 });
forumPostSchema.index({ isDeleted: 1, thread: 1 });
forumPostSchema.index({ content: 'text' });

// Virtual para contar respostas
forumPostSchema.virtual('replyCount', {
  ref: 'ForumPost',
  localField: '_id',
  foreignField: 'replyTo',
  count: true
});

// Método para adicionar reação
forumPostSchema.methods.addReaction = function(userId, reactionType) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  this.reactions.push({
    user: userId,
    type: reactionType
  });
  return this.save();
};

// Método para remover reação
forumPostSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Middleware para extrair menções do conteúdo
forumPostSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extrair @username do conteúdo
    const mentionRegex = /@(\w+)/g;
    const matches = [...this.content.matchAll(mentionRegex)];
    
    if (matches.length > 0) {
      // Buscar IDs dos usuários mencionados
      const usernames = matches.map(m => m[1]);
      // Nota: Isso precisa ser implementado de forma assíncrona em um hook post-save
      // ou no controller para buscar os IDs reais dos usuários
    }
  }
  next();
});

const ForumPost = mongoose.model('ForumPost', forumPostSchema);

module.exports = ForumPost;
