const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class NotificationEngine {
  /**
   * Dispatch a multi-lingual notification
   */
  static sendNotification({
    userId,
    type = 'SYSTEM',
    soundType = null,
    title_en,
    title_mr = null,
    title_hi = null,
    message_en,
    message_mr = null,
    message_hi = null,
    link = null,
    txDb = db
  }) {
    if (!userId || !title_en || !message_en) return null;

    const determinedSoundType = soundType || (type === 'PAYMENT' ? 'payment' : 'notification');
    const id = uuidv4();

    txDb.prepare(`
      INSERT INTO notifications (
        id, user_id, title_en, title_mr, title_hi, message_en, message_mr, message_hi, type, sound_type, is_read, link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      userId,
      title_en,
      title_mr || title_en,
      title_hi || title_en,
      message_en,
      message_mr || message_en,
      message_hi || message_en,
      type,
      determinedSoundType,
      link
    );

    return { id, userId, type, soundType: determinedSoundType, title: title_en };
  }

  /**
   * Notify all Admins
   */
  static notifyAdmins({
    type = 'SYSTEM',
    soundType = null,
    title_en,
    title_mr = null,
    title_hi = null,
    message_en,
    message_mr = null,
    message_hi = null,
    link = null,
    txDb = db
  }) {
    const adminUsers = (txDb || db).prepare(`SELECT id FROM users WHERE role = 'ADMIN'`).all();
    for (const admin of adminUsers) {
      this.sendNotification({
        userId: admin.id,
        type,
        soundType,
        title_en,
        title_mr,
        title_hi,
        message_en,
        message_mr,
        message_hi,
        link,
        txDb
      });
    }
  }
}

module.exports = NotificationEngine;
