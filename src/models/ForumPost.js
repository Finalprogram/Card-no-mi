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
  // Estrutura hierárquica estilo Reddit
  parentPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost',
    default: null
  },
  depth: {
    type: Number,
    default: 0
  },
  path: {
    type: String,
    default: ''
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
  // Sistema de votos estilo Reddit
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  score: {
    type: Number,
    default: 0
  },
  // Status
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
forumPostSchema.index({ thread: 1, path: 1 });
forumPostSchema.index({ author: 1, createdAt: -1 });
forumPostSchema.index({ parentPost: 1 });
forumPostSchema.index({ mentions: 1 });
forumPostSchema.index({ isDeleted: 1, thread: 1 });
forumPostSchema.index({ content: 'text' });
forumPostSchema.index({ score: -1, thread: 1 });

// Virtual para contar respostas
forumPostSchema.virtual('replyCount', {
  ref: 'ForumPost',
  localField: '_id',
  foreignField: 'parentPost',
  count: true
});

// Método para adicionar voto
forumPostSchema.methods.addVote = function(userId, voteType) {
  const userIdStr = userId.toString();
  
  // Remover voto anterior
  this.upvotes = this.upvotes.filter(id => id.toString() !== userIdStr);
  this.downvotes = this.downvotes.filter(id => id.toString() !== userIdStr);
  
  // Adicionar novo voto
  if (voteType === 'upvote') {
    this.upvotes.push(userId);
  } else if (voteType === 'downvote') {
    this.downvotes.push(userId);
  }
  
  // Calcular score
  this.score = this.upvotes.length - this.downvotes.length;
  
  return this.save();
};

// Método para remover voto
forumPostSchema.methods.removeVote = function(userId) {
  const userIdStr = userId.toString();
  this.upvotes = this.upvotes.filter(id => id.toString() !== userIdStr);
  this.downvotes = this.downvotes.filter(id => id.toString() !== userIdStr);
  this.score = this.upvotes.length - this.downvotes.length;
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
