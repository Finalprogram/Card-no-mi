const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Rotas de notificações
router.get('/notifications', notificationController.getNotifications);
router.get('/api/notifications/unread-count', notificationController.getUnreadCount);
router.get('/api/notifications/recent', notificationController.getRecentNotifications);
router.post('/api/notifications/:id/read', notificationController.markAsRead);
router.post('/api/notifications/read-all', notificationController.markAllAsRead);
router.delete('/api/notifications/:id', notificationController.deleteNotification);

module.exports = router;
