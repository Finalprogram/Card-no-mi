const { Op } = require('sequelize');
const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const ForumCategory = require('../models/ForumCategory');
const UserReputation = require('../models/UserReputation');
const logger = require('../config/logger');

// @desc    Get user profile
// @route   GET /forum/user/:username
// @access  Public
exports.getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ 
        where: { username },
        attributes: { exclude: ['password', 'verificationToken', 'verificationTokenExpires'] }
    });
    
    if (!user) {
      return res.status(404).render('pages/error', {
        message: 'Usuário não encontrado',
        user: req.session.user || null
      });
    }
    
    const threadCount = await ForumThread.count({
      where: { authorId: user.id, isDeleted: false }
    });
    
    const postCount = await ForumPost.count({
      where: { authorId: user.id, isDeleted: false }
    });
    
    const reputation = await UserReputation.findOne({ where: { userId: user.id } });
    const reputationScore = reputation ? reputation.totalPoints : 0;
    const reputationLevel = reputation ? reputation.title : 'Novato';
    
    const recentThreads = await ForumThread.findAll({
      where: { authorId: user.id, isDeleted: false, isActive: true },
      include: [{ model: ForumCategory, as: 'category', attributes: ['name', 'slug', 'icon', 'color'] }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    const recentPosts = await ForumPost.findAll({
      where: { authorId: user.id, isDeleted: false, isActive: true },
      include: [{ 
          model: ForumThread, 
          as: 'thread', 
          attributes: ['title', 'slug'],
          include: [{ model: ForumCategory, as: 'category', attributes: ['slug'] }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    const memberSince = new Date(user.createdAt).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long'
    });
    
    const isOwnProfile = req.session.user && req.session.user.username === username;
    
    let factionRankInfo = null;
    if (user.faction) {
      const { getCurrentRank } = require('../config/factionSystem');
      factionRankInfo = getCurrentRank(user.faction, user.factionPoints || 0);
    }
    
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
      factionRankInfo,
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
    
    const user = await User.findByPk(req.session.user.id, {
        attributes: { exclude: ['password'] }
    });
    
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
    
    if (bio && bio.length > 500) {
      return res.status(400).json({ success: false, message: 'Biografia muito longa (máximo 500 caracteres)' });
    }
    if (signature && signature.length > 200) {
      return res.status(400).json({ success: false, message: 'Assinatura muito longa (máximo 200 caracteres)' });
    }
    if (forumTitle && forumTitle.length > 50) {
      return res.status(400).json({ success: false, message: 'Título muito longo (máximo 50 caracteres)' });
    }
    
    const user = await User.findByPk(req.session.user.id);

    await user.update({
        bio: bio || '',
        signature: signature || '',
        forumTitle: forumTitle || '',
        website: website || '',
        location: location || '',
        socialLinks: {
            ...user.socialLinks,
            twitter: twitter || '',
            instagram: instagram || '',
            youtube: youtube || '',
            twitch: twitch || ''
        }
    });
    
    req.session.user = {
      ...req.session.user,
      bio: user.bio,
      signature: user.signature,
      forumTitle: user.forumTitle
    };
    
    res.json({ 
      success: true, 
      message: 'Perfil atualizado com sucesso!',
      redirect: `/forum/user/${user.username}`
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
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada' });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    const user = await User.findByPk(req.session.user.id);
    await user.update({ avatar: avatarUrl });
    
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
