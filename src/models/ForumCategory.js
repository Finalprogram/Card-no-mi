const mongoose = require('mongoose');

const forumCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  icon: {
    type: String,
    default: '💬'
  },
  description: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#A259FF'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  permissions: {
    canView: {
      type: [String],
      default: ['guest', 'user', 'moderator', 'admin']
    },
    canPost: {
      type: [String],
      default: ['user', 'moderator', 'admin']
    },
    canModerate: {
      type: [String],
      default: ['moderator', 'admin']
    }
  }
}, { timestamps: true });

// Índices
forumCategorySchema.index({ slug: 1 });
forumCategorySchema.index({ order: 1 });
forumCategorySchema.index({ isActive: 1 });

// Virtual para contar threads
forumCategorySchema.virtual('threadCount', {
  ref: 'ForumThread',
  localField: '_id',
  foreignField: 'category',
  count: true
});

const ForumCategory = mongoose.model('ForumCategory', forumCategorySchema);

module.exports = ForumCategory;
