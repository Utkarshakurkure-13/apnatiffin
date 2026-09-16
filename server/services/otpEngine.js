const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const NotificationEngine = require('./notificationEngine');

/**
 * Secure OTP Engine for Delivery Verification
 */
class OTPEngine {
  /**
   * Generate secure 4-digit OTP
   */
  static generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Verify delivery OTP submitted by Provider
   */
  static verifyDeliveryOTP(orderId, providerId, inputOtp) {
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.user_id as provider_user_id,
             p.provider_name, c.full_name as customer_name
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ? AND o.provider_id = ?
    `).get(orderId, providerId);

    if (!order) {
      throw new Error('Order not found or unauthorized provider');
    }

    if (order.order_status === 'DELIVERED') {
      return { success: true, alreadyDelivered: true, message: 'Order is already marked as DELIVERED.' };
    }

    if (!['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.order_status)) {
      throw new Error(`Cannot verify OTP for order in status: ${order.order_status}`);
    }

    if (order.delivery_otp_attempts >= 5) {
      throw new Error('Too many invalid OTP attempts. Please upload delivery proof or contact support.');
    }

    const cleanInputOtp = String(inputOtp).trim();
    if (order.delivery_otp !== cleanInputOtp) {
      // Increment attempt counter
      const newAttempts = (order.delivery_otp_attempts || 0) + 1;
      db.prepare(`UPDATE orders SET delivery_otp_attempts = ? WHERE id = ?`).run(newAttempts, orderId);
      
      const attemptsLeft = 5 - newAttempts;
      throw new Error(`Invalid Delivery OTP. ${attemptsLeft} attempt(s) remaining.`);
    }

    // OTP is valid! Atomically complete delivery
    const txn = db.transaction(() => {
      // 1. Mark order as DELIVERED
      db.prepare(`
        UPDATE orders
        SET order_status = 'DELIVERED',
            otp_verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orderId);

      // 2. If this is a subscription order, mark meal as used and update subscription_meals
      if (order.plan_type !== 'SINGLE') {
        const sub = db.prepare(`SELECT * FROM subscriptions WHERE order_id = ?`).get(orderId);
        if (sub) {
          if (order.meal_type === 'LUNCH' || order.meal_type === 'BOTH') {
            db.prepare(`UPDATE subscriptions SET used_lunch = used_lunch + 1 WHERE id = ?`).run(sub.id);
          }
          if (order.meal_type === 'DINNER' || order.meal_type === 'BOTH') {
            db.prepare(`UPDATE subscriptions SET used_dinner = used_dinner + 1 WHERE id = ?`).run(sub.id);
          }
          // Update today's subscription_meals row
          const today = new Date().toISOString().split('T')[0];
          db.prepare(`
            UPDATE subscription_meals
            SET status = 'DELIVERED',
                delivery_status = 'DELIVERED',
                delivery_time = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ? AND meal_date = ?
          `).run(sub.id, today);
        }
      } else {
        // Also check if an active subscription_meals row exists with this order_id
        db.prepare(`
          UPDATE subscription_meals
          SET status = 'DELIVERED',
              delivery_status = 'DELIVERED',
              delivery_time = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE order_id = ?
        `).run(orderId);
      }

      // 3. Send Delivery Notifications
      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'DELIVERY',
        soundType: 'notification',
        title_en: 'Tiffin Delivered Successfully! Enjoy your meal 🍲',
        title_mr: 'डबा यशस्वीरीत्या पोहोचवला! जेवणाचा आनंद घ्या 🍲',
        title_hi: 'टिफिन सफलतापूर्वक डिलीवर हुआ! भोजन का आनंद लें 🍲',
        message_en: `Your meal from ${order.provider_name} (Order #${order.order_number}) was delivered! Please leave a rating to earn bonus points.`,
        message_mr: `तुमचा ${order.provider_name} कडून आलेला डबा (ऑर्डर #${order.order_number}) पोहोचवला गेला आहे! कृपया रेटिंग द्या आणि पॉइंट्स मिळवा.`,
        message_hi: `${order.provider_name} से आपका खाना (ऑर्डर #${order.order_number}) डिलीवर हो गया! बोनस पॉइंट्स के लिए रेटिंग दें।`,
        link: '/customer/orders'
      });

      // Provider: Payment earned / credited notification
      NotificationEngine.sendNotification({
        userId: order.provider_user_id,
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Order Completed & Payment Credited 💰',
        title_mr: 'ऑर्डर पूर्ण झाली आणि रक्कम जमा झाली 💰',
        title_hi: 'ऑर्डर पूरा हुआ और भुगतान जमा हुआ 💰',
        message_en: `Order #${order.order_number} marked DELIVERED. Earnings credited to your account.`,
        message_mr: `ऑर्डर #${order.order_number} यशस्वीपणे पोहोचवली गेली. कमाई खात्यात जमा झाली.`,
        message_hi: `ऑर्डर #${order.order_number} डिलीवर हुआ। कमाई आपके खाते में क्रेडिट की गई।`,
        link: '/provider/earnings'
      });

      // Admin notification
      NotificationEngine.notifyAdmins({
        type: 'DELIVERY',
        soundType: 'notification',
        title_en: 'Order Delivered',
        title_mr: 'ऑर्डर पोहोचवली गेली',
        title_hi: 'ऑर्डर डिलीवर हुआ',
        message_en: `Order #${order.order_number} delivered successfully by ${order.provider_name}.`,
        message_mr: `ऑर्डर #${order.order_number} यशस्वीपणे पोहोचवली गेली.`,
        message_hi: `ऑर्डर #${order.order_number} सफलतापूर्वक डिलीवर हो गया।`,
        link: '/admin/orders'
      });

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'ORDER_DELIVERED_VIA_OTP', 'ORDER', ?, ?)
      `).run(
        uuidv4(),
        order.provider_user_id,
        orderId,
        JSON.stringify({ verifiedAt: new Date().toISOString() })
      );
    });

    txn();

    return {
      success: true,
      orderId,
      orderNumber: order.order_number,
      orderStatus: 'DELIVERED',
      message: 'Delivery verified successfully via Customer OTP!'
    };
  }

  /**
   * Complete delivery using Photo Proof when Customer is unavailable
   */
  static completeDeliveryViaPhoto(orderId, providerId, photoUrl) {
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.user_id as provider_user_id, p.provider_name
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ? AND o.provider_id = ?
    `).get(orderId, providerId);

    if (!order) {
      throw new Error('Order not found or unauthorized provider');
    }

    if (order.order_status === 'DELIVERED') {
      return { success: true, alreadyDelivered: true, message: 'Order is already marked as DELIVERED.' };
    }

    const txn = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET order_status = 'DELIVERED',
            delivery_proof_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(photoUrl, orderId);

      // Sync subscription meals
      if (order.plan_type !== 'SINGLE') {
        const sub = db.prepare(`SELECT * FROM subscriptions WHERE order_id = ?`).get(orderId);
        if (sub) {
          const today = new Date().toISOString().split('T')[0];
          db.prepare(`
            UPDATE subscription_meals
            SET status = 'DELIVERED',
                delivery_status = 'DELIVERED',
                delivery_proof_url = ?,
                delivery_time = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ? AND meal_date = ?
          `).run(photoUrl, sub.id, today);
        }
      }

      // Notification to customer
      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'DELIVERY',
        soundType: 'notification',
        title_en: 'Tiffin Placed at Doorstep (Photo Proof Attached)',
        title_mr: 'डबा दरवाजाबाहेर ठेवला (फोटो जोडला आहे)',
        title_hi: 'टिफिन दरवाजे पर रखा गया (फोटो प्रमाण संलग्न)',
        message_en: `Your tiffin from ${order.provider_name} (Order #${order.order_number}) was placed securely. Delivery photo proof is available in your active orders.`,
        message_mr: `तुमचा ${order.provider_name} कडून आलेला डबा (ऑर्डर #${order.order_number}) सुरक्षितपणे ठेवण्यात आला आहे. डिलिव्हरी फोटो ऑर्डर विभागात उपलब्ध आहे.`,
        message_hi: `${order.provider_name} से आपका टिफिन (ऑर्डर #${order.order_number}) सुरक्षित रख दिया गया है। डिलीवरी फोटो प्रमाण ऐप में देखें।`,
        link: '/customer/orders'
      });

      // Provider: Payment earned / credited notification
      NotificationEngine.sendNotification({
        userId: order.provider_user_id,
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Order Completed & Payment Credited 💰',
        title_mr: 'ऑर्डर पूर्ण झाली आणि रक्कम जमा झाली 💰',
        title_hi: 'ऑर्डर पूरा हुआ और भुगतान जमा हुआ 💰',
        message_en: `Order #${order.order_number} marked DELIVERED via photo proof. Earnings credited to your account.`,
        message_mr: `ऑर्डर #${order.order_number} फोटो पुराव्यासह पूर्ण झाली. कमाई खात्यात जमा झाली.`,
        message_hi: `ऑर्डर #${order.order_number} फोटो प्रमाण से डिलीवर हुआ। कमाई आपके खाते में क्रेडिट की गई।`,
        link: '/provider/earnings'
      });

      // Admin notification
      NotificationEngine.notifyAdmins({
        type: 'DELIVERY',
        soundType: 'notification',
        title_en: 'Order Delivered (Photo Proof)',
        title_mr: 'ऑर्डर पोहोचवली गेली (फोटो पुरावा)',
        title_hi: 'ऑर्डर डिलीवर हुआ (फोटो प्रमाण)',
        message_en: `Order #${order.order_number} delivered with photo proof by ${order.provider_name}.`,
        message_mr: `ऑर्डर #${order.order_number} फोटो पुराव्यासह यशस्वीपणे पोहोचवली गेली.`,
        message_hi: `ऑर्डर #${order.order_number} फोटो प्रमाण के साथ डिलीवर हुआ।`,
        link: '/admin/orders'
      });

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'ORDER_DELIVERED_VIA_PHOTO_PROOF', 'ORDER', ?, ?)
      `).run(
        uuidv4(),
        order.provider_user_id,
        orderId,
        JSON.stringify({ photoUrl })
      );
    });

    txn();

    return {
      success: true,
      orderId,
      orderNumber: order.order_number,
      orderStatus: 'DELIVERED',
      deliveryProofUrl: photoUrl,
      message: 'Delivery proof uploaded and order marked as DELIVERED.'
    };
  }
}

module.exports = OTPEngine;
