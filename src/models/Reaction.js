const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  emoji: {
    type: String,
    required: true,
    enum: ['👍', '👎', '❤️', '😂', '🔥', '👀', '🎉', '😮']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índice composto para evitar reações duplicadas
ReactionSchema.index({ post: 1, user: 1, emoji: 1 }, { unique: true });

// Método para alternar reação (add/remove)
ReactionSchema.statics.toggleReaction = async function(postId, userId, emoji) {
  const existing = await this.findOne({ post: postId, user: userId, emoji });
  
  if (existing) {
    await existing.deleteOne();
    return { action: 'removed', reaction: null };
  } else {
    const reaction = await this.create({ post: postId, user: userId, emoji });
    return { action: 'added', reaction };
  }
};

// Método para obter contagem de reações por tipo
ReactionSchema.statics.getReactionCounts = async function(postId) {
  const reactions = await this.aggregate([
    { $match: { post: new mongoose.Types.ObjectId(postId) } },
    { $group: { _id: '$emoji', count: { $sum: 1 } } },
    { $project: { emoji: '$_id', count: 1, _id: 0 } }
  ]);
  
  return reactions;
};

// Método para obter reações do usuário em um post
ReactionSchema.statics.getUserReactions = async function(postId, userId) {
  const reactions = await this.find({ post: postId, user: userId }).select('emoji');
  return reactions.map(r => r.emoji);
};

module.exports = mongoose.model('Reaction', ReactionSchema);
