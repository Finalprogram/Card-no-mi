const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const UserReputation = require('../models/UserReputation');
const logger = require('../config/logger');

// @desc    Get user profile
// @route   GET /forum/user/:username
// @access  Public
exports.getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ username })
      .select('-password -verificationToken -verificationTokenExpires')
      .lean();
    
    if (!user) {
      return res.status(404).render('pages/error', {
        message: 'Usuário não encontrado',
        user: req.session.user || null
      });
    }
    
    // Buscar estatísticas do usuário
    const threadCount = await ForumThread.countDocuments({
      author: user._id,
      isDeleted: false
    });
    
    const postCount = await ForumPost.countDocuments({
      author: user._id,
      isDeleted: false
    });
    
    // Buscar reputação
    const reputation = await UserReputation.findOne({ user: user._id });
    const reputationScore = reputation ? reputation.score : 0;
    const reputationLevel = reputation ? reputation.level : 'Novato';
    
    // Últimos threads do usuário
    const recentThreads = await ForumThread.find({
      author: user._id,
      isDeleted: false,
      isActive: true
    })
      .populate('category', 'name slug icon color')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Últimos posts do usuário
    const recentPosts = await ForumPost.find({
      author: user._id,
      isDeleted: false,
      isActive: true
    })
      .populate('thread', 'title slug')
      .populate({
        path: 'thread',
        populate: {
          path: 'category',
          select: 'slug'
        }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Data de registro formatada
    const memberSince = new Date(user.createdAt).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long'
    });
    
    // Verificar se é o próprio usuário
    const isOwnProfile = req.session.user && req.session.user.username === username;
    
    res.render('pages/forum/profile', {
      profileUser: user,
      threadCount,
      postCount,
      reputationScore,
      reputationLevel,
      recentThreads,
      recentPosts,
      memberSince,
      isOwnProfile,
      user: req.session.user || null,
      pageTitle: `${user.username} - Perfil`
    });
    
  } catch (error) {
    logger.error('Erro ao buscar perfil do usuário:', error);
    res.status(500).send('Erro interno do servidor');
  }
};

// @desc    Get edit profile page
// @route   GET /forum/profile/edit
// @access  Private
exports.getEditProfile = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    
    const user = await User.findById(req.session.user._id)
      .select('-password')
      .lean();
    
    res.render('pages/forum/edit-profile', {
      profileUser: user,
      user: req.session.user,
      pageTitle: 'Editar Perfil'
    });
    
  } catch (error) {
    logger.error('Erro ao buscar página de edição:', error);
    res.status(500).send('Erro interno do servidor');
  }
};

// @desc    Update user profile
// @route   POST /forum/profile/edit
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    
    const {
      bio,
      signature,
      forumTitle,
      website,
      location,
      twitter,
      instagram,
      youtube,
      twitch
    } = req.body;
    
    // Validações
    if (bio && bio.length > 500) {
      return res.status(400).json({ 
        success: false, 
        message: 'Biografia muito longa (máximo 500 caracteres)' 
      });
    }
    
    if (signature && signature.length > 200) {
      return res.status(400).json({ 
        success: false, 
        message: 'Assinatura muito longa (máximo 200 caracteres)' 
      });
    }
    
    if (forumTitle && forumTitle.length > 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Título muito longo (máximo 50 caracteres)' 
      });
    }
    
    // Atualizar usuário
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      {
        bio: bio || '',
        signature: signature || '',
        forumTitle: forumTitle || '',
        website: website || '',
        location: location || '',
        'socialLinks.twitter': twitter || '',
        'socialLinks.instagram': instagram || '',
        'socialLinks.youtube': youtube || '',
        'socialLinks.twitch': twitch || ''
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    // Atualizar sessão
    req.session.user = {
      ...req.session.user,
      bio: updatedUser.bio,
      signature: updatedUser.signature,
      forumTitle: updatedUser.forumTitle
    };
    
    res.json({ 
      success: true, 
      message: 'Perfil atualizado com sucesso!',
      redirect: `/forum/user/${updatedUser.username}`
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar perfil' 
    });
  }
};

// @desc    Upload avatar
// @route   POST /forum/profile/avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhuma imagem enviada' 
      });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Atualizar usuário
    await User.findByIdAndUpdate(
      req.session.user._id,
      { avatar: avatarUrl }
    );
    
    // Atualizar sessão
    req.session.user.avatar = avatarUrl;
    
    res.json({ 
      success: true, 
      message: 'Avatar atualizado com sucesso!',
      avatarUrl 
    });
    
  } catch (error) {
    logger.error('Erro ao fazer upload do avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao fazer upload do avatar' 
    });
  }
};

module.exports = exports;
