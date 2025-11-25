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
  // Hierarquia de categorias/subcategorias
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    default: null
  },
  isSubforum: {
    type: Boolean,
    default: false
  },
  // Controle de exibição
  showInHome: {
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
forumCategorySchema.index({ parentCategory: 1 });
forumCategorySchema.index({ isSubforum: 1 });

// Virtual para contar threads
forumCategorySchema.virtual('threadCount', {
  ref: 'ForumThread',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Virtual para subcategorias
forumCategorySchema.virtual('subforums', {
  ref: 'ForumCategory',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Métodos
forumCategorySchema.methods.getFullPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parentCategory) {
    current = await mongoose.model('ForumCategory').findById(current.parentCategory);
    if (current) {
      path.unshift(current.name);
    } else {
      break;
    }
  }
  
  return path;
};

forumCategorySchema.set('toJSON', { virtuals: true });
forumCategorySchema.set('toObject', { virtuals: true });

const ForumCategory = mongoose.model('ForumCategory', forumCategorySchema);

module.exports = ForumCategory;
