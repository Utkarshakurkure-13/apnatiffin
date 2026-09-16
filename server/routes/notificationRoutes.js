const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');
const NotificationEngine = require('../services/notificationEngine');

// All notification endpoints require valid JWT authentication
router.use(authenticateJWT);

/**
 * GET /api/notifications - Get current authenticated user's notifications and unread count
 */
router.get('/', (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);

    const unreadCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(req.user.id);

    const unreadCount = unreadCountRow ? unreadCountRow.count : 0;

    return res.json({
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error('[NOTIFICATIONS GET ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/notifications/:id/read - Mark specific notification as read
 */
router.put('/:id/read', (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/notifications/read-all - Mark all notifications as read for current user
 */
router.put('/read-all', (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND is_read = 0
    `).run(req.user.id);

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/test - Trigger a test notification (useful for verification)
 */
router.post('/test', (req, res) => {
  try {
    const { type = 'SYSTEM', soundType = 'notification', title, message } = req.body;
    const notification = NotificationEngine.sendNotification({
      userId: req.user.id,
      type,
      soundType,
      title_en: title || 'Test Notification',
      message_en: message || 'This is a test notification from Aapna Tiffin.'
    });

    return res.json({ success: true, notification });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
