const Notification = require('../models/Notification');
const logger = require('../config/logger');

// @desc    Get user notifications page
// @route   GET /forum/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.getUserNotifications(
      req.session.user.id,
      limit,
      skip
    );
    
    const totalNotifications = await Notification.countDocuments({
      recipient: req.session.user.id
    });
    
    const totalPages = Math.ceil(totalNotifications / limit);
    
    res.render('pages/forum/notifications', {
      notifications,
      currentPage: page,
      totalPages,
      user: req.session.user,
      pageTitle: 'Notificações'
    });
    
  } catch (error) {
    logger.error('Erro ao buscar notificações:', error);
    res.status(500).send('Erro interno do servidor');
  }
};

// @desc    Get unread notifications count (for navbar badge)
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ count: 0 });
    }
    
    const count = await Notification.getUnreadCount(req.session.user.id);
    res.json({ count });
    
  } catch (error) {
    logger.error('Erro ao buscar contagem de notificações:', error);
    res.json({ count: 0 });
  }
};

// @desc    Get recent notifications for dropdown (5 most recent)
// @route   GET /api/notifications/recent
// @access  Private
exports.getRecentNotifications = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ notifications: [] });
    }
    
    const notifications = await Notification.getUserNotifications(
      req.session.user.id,
      5,
      0
    );
    
    res.json({ notifications });
    
  } catch (error) {
    logger.error('Erro ao buscar notificações recentes:', error);
    res.json({ notifications: [] });
  }
};

// @desc    Mark notification as read
// @route   POST /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    
    const { id } = req.params;
    
    await Notification.markAsRead(id, req.session.user.id);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar notificação' });
  }
};

// @desc    Mark all notifications as read
// @route   POST /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    
    await Notification.markAllAsRead(req.session.user.id);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar notificações' });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    
    const { id } = req.params;
    
    await Notification.findOneAndDelete({
      _id: id,
      recipient: req.session.user.id
    });
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Erro ao deletar notificação:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar notificação' });
  }
};

module.exports = exports;
