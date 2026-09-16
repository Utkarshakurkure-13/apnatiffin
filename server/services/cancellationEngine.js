const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const NotificationEngine = require('./notificationEngine');

/**
 * Cancellation & Refund Engine for Aapna Tiffin
 * Implements strict, server-side authoritative financial calculations.
 */
class CancellationEngine {
  /**
   * Calculate customer cancellation outcome
   * Rule: <= 60 mins -> 10% deduction, 90% refund. > 60 mins -> 0% refund.
   */
  static processCustomerCancellation(orderId, customerId, reason = 'Customer requested cancellation') {
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.user_id as provider_user_id
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ? AND o.customer_id = ?
    `).get(orderId, customerId);

    if (!order) {
      throw new Error('Order not found or access denied');
    }

    if (['DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED'].includes(order.order_status)) {
      throw new Error(`Order cannot be cancelled in status: ${order.order_status}`);
    }

    const orderCreatedAt = new Date(order.created_at).getTime();
    const now = Date.now();
    const minutesElapsed = (now - orderCreatedAt) / (1000 * 60);

    // Fetch configurable deduction percentage from admin_settings
    const deductionSetting = db.prepare(`SELECT value FROM admin_settings WHERE key = 'customer_early_cancellation_deduction_percent'`).get();
    const deductionPercent = deductionSetting ? parseFloat(deductionSetting.value) : 10.0;

    let deductionAmount = 0.0;
    let refundAmount = 0.0;
    let isWithinOneHour = minutesElapsed <= 60;

    if (isWithinOneHour) {
      deductionAmount = Math.round((order.final_amount * (deductionPercent / 100)) * 100) / 100;
      refundAmount = Math.round((order.final_amount - deductionAmount) * 100) / 100;
    } else {
      deductionAmount = order.final_amount;
      refundAmount = 0.0;
    }

    const txn = db.transaction(() => {
      // 1. Update Order
      db.prepare(`
        UPDATE orders 
        SET order_status = 'CANCELLED',
            cancelled_by = 'CUSTOMER',
            cancellation_reason = ?,
            cancellation_time = CURRENT_TIMESTAMP,
            deduction_amount = ?,
            refund_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason, deductionAmount, refundAmount, orderId);

      // 2. Update Customer Bill
      db.prepare(`
        UPDATE bills
        SET cancellation_deduction = ?,
            refund_amount = ?,
            refund_status = ?,
            payment_status = 'CANCELLED'
        WHERE order_id = ? AND bill_type = 'CUSTOMER'
      `).run(
        deductionAmount,
        refundAmount,
        refundAmount > 0 ? (deductionAmount > 0 ? 'PARTIAL' : 'FULL') : 'NONE',
        orderId
      );

      // 3. Create Refund Record if eligible
      if (refundAmount > 0) {
        db.prepare(`
          INSERT INTO payments (id, order_id, customer_id, provider_id, amount, payment_method, gateway, gateway_txn_id, status)
          VALUES (?, ?, ?, ?, ?, 'REFUND', 'Razorpay Mock', ?, 'REFUNDED')
        `).run(uuidv4(), orderId, order.customer_id, order.provider_id, refundAmount, `REF-${Date.now()}`);
      }

      // 4. Notify Provider and Customer
      NotificationEngine.sendNotification({
        userId: order.provider_user_id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Cancelled by Customer',
        title_mr: 'ग्राहकाने ऑर्डर रद्द केली',
        title_hi: 'ग्राहक द्वारा ऑर्डर रद्द किया गया',
        message_en: `Order #${order.order_number} was cancelled by customer. Reason: ${reason}`,
        message_mr: `ऑर्डर #${order.order_number} ग्राहकाने रद्द केली. कारण: ${reason}`,
        message_hi: `ऑर्डर #${order.order_number} ग्राहक द्वारा रद्द कर दिया गया। कारण: ${reason}`,
        link: '/provider/orders'
      });

      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Cancellation Confirmed',
        title_mr: 'ऑर्डर रद्द झाल्याची पुष्टी',
        title_hi: 'ऑर्डर रद्द करने की पुष्टि',
        message_en: `Order #${order.order_number} cancelled. Refund: ₹${refundAmount.toFixed(2)}, Deduction: ₹${deductionAmount.toFixed(2)}.`,
        message_mr: `ऑर्डर #${order.order_number} रद्द केली. परतावा: ₹${refundAmount.toFixed(2)}, कपात: ₹${deductionAmount.toFixed(2)}.`,
        message_hi: `ऑर्डर #${order.order_number} रद्द किया गया। रिफंड: ₹${refundAmount.toFixed(2)}, कटौती: ₹${deductionAmount.toFixed(2)}।`,
        link: '/customer/bills'
      });

      if (refundAmount > 0) {
        NotificationEngine.sendNotification({
          userId: order.customer_user_id,
          type: 'PAYMENT',
          soundType: 'payment',
          title_en: 'Refund Initiated',
          title_mr: 'परतावा सुरू झाला',
          title_hi: 'रिफंड शुरू हुआ',
          message_en: `Refund of ₹${refundAmount.toFixed(2)} initiated for Order #${order.order_number}.`,
          message_mr: `ऑर्डर #${order.order_number} साठी ₹${refundAmount.toFixed(2)} चा परतावा जमा करण्यात आला.`,
          message_hi: `ऑर्डर #${order.order_number} के लिए ₹${refundAmount.toFixed(2)} का रिफंड शुरू हुआ।`,
          link: '/customer/bills'
        });
      }

      NotificationEngine.notifyAdmins({
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Cancelled',
        title_mr: 'ऑर्डर रद्द झाली',
        title_hi: 'ऑर्डर रद्द हुआ',
        message_en: `Order #${order.order_number} cancelled by customer. Refund: ₹${refundAmount.toFixed(2)}.`,
        message_mr: `ऑर्डर #${order.order_number} ग्राहकाकडून रद्द केली. परतावा: ₹${refundAmount.toFixed(2)}.`,
        message_hi: `ऑर्डर #${order.order_number} ग्राहक द्वारा रद्द। रिफंड: ₹${refundAmount.toFixed(2)}।`,
        link: '/admin/orders'
      });

      // 5. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'CUSTOMER_ORDER_CANCELLED', 'ORDER', ?, ?)
      `).run(
        uuidv4(),
        order.customer_user_id,
        orderId,
        JSON.stringify({ minutesElapsed, deductionAmount, refundAmount, isWithinOneHour })
      );
    });

    txn();

    return {
      orderId,
      orderNumber: order.order_number,
      isWithinOneHour,
      deductionAmount,
      refundAmount,
      status: 'CANCELLED'
    };
  }

  /**
   * Process Provider Cancellation
   * Rule: <= 60 mins -> Full refund + 0 penalty.
   *       > 60 mins  -> Full refund + Configured Provider Penalty (20% or 30% pending product decision) + 20 Customer Points compensation.
   */
  static processProviderCancellation(orderId, providerId, reason = 'Kitchen capacity / unavailable') {
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.user_id as provider_user_id
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ? AND o.provider_id = ?
    `).get(orderId, providerId);

    if (!order) {
      throw new Error('Order not found or provider unauthorized');
    }

    if (['DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED'].includes(order.order_status)) {
      throw new Error(`Order cannot be cancelled in status: ${order.order_status}`);
    }

    const orderCreatedAt = new Date(order.created_at).getTime();
    const now = Date.now();
    const minutesElapsed = (now - orderCreatedAt) / (1000 * 60);
    const isWithinOneHour = minutesElapsed <= 60;

    // Fetch penalty percent setting (20% default or 30% pending product decision)
    const penaltySetting = db.prepare(`SELECT value FROM admin_settings WHERE key = 'provider_late_cancellation_penalty_percent'`).get();
    const penaltyPercent = penaltySetting ? parseFloat(penaltySetting.value) : 20.0;

    const refundAmount = order.final_amount; // Full refund to customer always
    let providerPenalty = 0.0;
    let customerPointsAwarded = 0;

    if (!isWithinOneHour) {
      providerPenalty = Math.round((order.final_amount * (penaltyPercent / 100)) * 100) / 100;
      customerPointsAwarded = 20; // 20 reward points compensation
    }

    const txn = db.transaction(() => {
      // 1. Update Order
      db.prepare(`
        UPDATE orders 
        SET order_status = 'CANCELLED',
            cancelled_by = 'PROVIDER',
            cancellation_reason = ?,
            cancellation_time = CURRENT_TIMESTAMP,
            deduction_amount = 0.00,
            refund_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason, refundAmount, orderId);

      // 2. Update Customer Bill
      db.prepare(`
        UPDATE bills
        SET cancellation_deduction = 0.00,
            refund_amount = ?,
            refund_status = 'FULL',
            payment_status = 'REFUNDED'
        WHERE order_id = ? AND bill_type = 'CUSTOMER'
      `).run(refundAmount, orderId);

      // 3. Update Provider Bill with penalty
      db.prepare(`
        UPDATE bills
        SET provider_penalty = ?,
            final_payable = 0.00,
            refund_amount = ?,
            payment_status = 'CANCELLED'
        WHERE order_id = ? AND bill_type = 'PROVIDER'
      `).run(providerPenalty, refundAmount, orderId);

      // 4. Record Penalty Ledger if late cancellation
      if (providerPenalty > 0) {
        db.prepare(`
          INSERT INTO penalty_ledger (id, provider_id, order_id, penalty_points, penalty_amount, reason, balance_points_after)
          VALUES (?, ?, ?, 0, ?, 'Late Provider Cancellation Penalty', 0)
        `).run(uuidv4(), order.provider_id, orderId, providerPenalty);
      }

      // 5. Compensate customer with +20 points if late cancellation
      if (customerPointsAwarded > 0) {
        // Calculate existing points
        const pointsRow = db.prepare(`
          SELECT COALESCE(SUM(points_change), 0) as total_pts 
          FROM customer_points_ledger 
          WHERE customer_id = ?
        `).get(order.customer_id);
        const newBalance = (pointsRow ? pointsRow.total_pts : 0) + customerPointsAwarded;

        db.prepare(`
          INSERT INTO customer_points_ledger (id, customer_id, order_id, points_change, reason, balance_after)
          VALUES (?, ?, ?, ?, 'Compensation for Late Provider Cancellation', ?)
        `).run(uuidv4(), order.customer_id, orderId, customerPointsAwarded, newBalance);
      }

      // 6. Send Notifications
      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Cancelled by Kitchen',
        title_mr: 'स्वयंपाकी/किचनने ऑर्डर रद्द केली',
        title_hi: 'किचन द्वारा ऑर्डर रद्द',
        message_en: `Order #${order.order_number} was cancelled by kitchen (${reason}).${customerPointsAwarded ? ' +20 Reward points credited!' : ''}`,
        message_mr: `ऑर्डर #${order.order_number} किचनने रद्द केली (${reason}).${customerPointsAwarded ? ' +20 बोनस पॉइंट्स जमा झाले!' : ''}`,
        message_hi: `ऑर्डर #${order.order_number} किचन द्वारा रद्द की गई (${reason})।${customerPointsAwarded ? ' +20 रिवॉर्ड पॉइंट्स मिले!' : ''}`,
        link: '/customer/bills'
      });

      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Full Refund Processed',
        title_mr: 'पूर्ण परतावा जमा झाला',
        title_hi: 'पूरा रिफंड संसाधित हुआ',
        message_en: `Full refund of ₹${refundAmount.toFixed(2)} processed for Order #${order.order_number}.`,
        message_mr: `ऑर्डर #${order.order_number} साठी ₹${refundAmount.toFixed(2)} चा पूर्ण परतावा जमा करण्यात आला आहे.`,
        message_hi: `ऑर्डर #${order.order_number} के लिए ₹${refundAmount.toFixed(2)} का पूरा रिफंड संसाधित हुआ।`,
        link: '/customer/bills'
      });

      NotificationEngine.sendNotification({
        userId: order.provider_user_id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Cancelled',
        title_mr: 'ऑर्डर रद्द झाली',
        title_hi: 'ऑर्डर रद्द हुआ',
        message_en: `You cancelled Order #${order.order_number}.${providerPenalty > 0 ? ` Late penalty: ₹${providerPenalty.toFixed(2)}.` : ''}`,
        message_mr: `तुम्ही ऑर्डर #${order.order_number} रद्द केली.${providerPenalty > 0 ? ` दंड: ₹${providerPenalty.toFixed(2)}.` : ''}`,
        message_hi: `आपने ऑर्डर #${order.order_number} रद्द किया।${providerPenalty > 0 ? ` जुर्माना: ₹${providerPenalty.toFixed(2)}।` : ''}`,
        link: '/provider/orders'
      });

      NotificationEngine.notifyAdmins({
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Provider Cancelled Order',
        title_mr: 'प्रदात्याने ऑर्डर रद्द केली',
        title_hi: 'प्रदाता द्वारा ऑर्डर रद्द',
        message_en: `Order #${order.order_number} cancelled by provider. Refund: ₹${refundAmount.toFixed(2)}. Penalty: ₹${providerPenalty.toFixed(2)}.`,
        message_mr: `प्रदात्याने ऑर्डर #${order.order_number} रद्द केली. परतावा: ₹${refundAmount.toFixed(2)}. दंड: ₹${providerPenalty.toFixed(2)}.`,
        message_hi: `प्रदाता ने ऑर्डर #${order.order_number} रद्द किया। रिफंड: ₹${refundAmount.toFixed(2)}। जुर्माना: ₹${providerPenalty.toFixed(2)}।`,
        link: '/admin/orders'
      });

      // 7. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'PROVIDER_ORDER_CANCELLED', 'ORDER', ?, ?)
      `).run(
        uuidv4(),
        order.provider_user_id,
        orderId,
        JSON.stringify({ minutesElapsed, providerPenalty, refundAmount, customerPointsAwarded })
      );
    });

    txn();

    return {
      orderId,
      orderNumber: order.order_number,
      isWithinOneHour,
      refundAmount,
      providerPenalty,
      customerPointsAwarded,
      status: 'CANCELLED'
    };
  }

  /**
   * Process Delivery Failure
   * Rule: Full customer refund + 20% provider penalty + 10 penalty points
   */
  static processDeliveryFailure(orderId, adminOrSystemId, reason = 'Delivery not fulfilled') {
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.user_id as provider_user_id
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ?
    `).get(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const penaltySetting = db.prepare(`SELECT value FROM admin_settings WHERE key = 'delivery_failure_penalty_percent'`).get();
    const penaltyPercent = penaltySetting ? parseFloat(penaltySetting.value) : 20.0;
    const penaltyPointsSetting = db.prepare(`SELECT value FROM admin_settings WHERE key = 'delivery_failure_penalty_points'`).get();
    const penaltyPoints = penaltyPointsSetting ? parseInt(penaltyPointsSetting.value) : 10;

    const refundAmount = order.final_amount;
    const providerPenalty = Math.round((order.final_amount * (penaltyPercent / 100)) * 100) / 100;

    const txn = db.transaction(() => {
      // 1. Update Order to FAILED
      db.prepare(`
        UPDATE orders 
        SET order_status = 'FAILED',
            cancellation_reason = ?,
            cancellation_time = CURRENT_TIMESTAMP,
            refund_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason, refundAmount, orderId);

      // 2. Update Customer Bill
      db.prepare(`
        UPDATE bills
        SET refund_amount = ?,
            refund_status = 'FULL',
            payment_status = 'REFUNDED'
        WHERE order_id = ? AND bill_type = 'CUSTOMER'
      `).run(refundAmount, orderId);

      // 3. Provider penalty ledger & points
      const pointsRow = db.prepare(`
        SELECT COALESCE(SUM(penalty_points), 0) as total_pts 
        FROM penalty_ledger 
        WHERE provider_id = ?
      `).get(order.provider_id);
      const newPenaltyPoints = (pointsRow ? pointsRow.total_pts : 0) + penaltyPoints;

      db.prepare(`
        INSERT INTO penalty_ledger (id, provider_id, order_id, penalty_points, penalty_amount, reason, balance_points_after)
        VALUES (?, ?, ?, ?, ?, 'Delivery Failure Penalty', ?)
      `).run(uuidv4(), order.provider_id, orderId, penaltyPoints, providerPenalty, newPenaltyPoints);

      // 4. Notifications
      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Delivery Failed',
        title_mr: 'डिलिव्हरी अयशस्वी',
        title_hi: 'डिलीवरी विफल',
        message_en: `Order #${order.order_number} marked as delivery failed. Full refund processed.`,
        message_mr: `ऑर्डर #${order.order_number} डिलिव्हरी अयशस्वी झाली. पूर्ण परतावा जमा करण्यात आला आहे.`,
        message_hi: `ऑर्डर #${order.order_number} डिलीवरी विफल रही। पूरा रिफंड प्रोसेस किया गया।`,
        link: '/customer/bills'
      });

      NotificationEngine.sendNotification({
        userId: order.customer_user_id,
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Full Refund Processed',
        title_mr: 'पूर्ण परतावा जमा झाला',
        title_hi: 'पूरा रिफंड संसाधित हुआ',
        message_en: `Full refund of ₹${refundAmount.toFixed(2)} processed for Order #${order.order_number}.`,
        message_mr: `ऑर्डर #${order.order_number} साठी ₹${refundAmount.toFixed(2)} चा पूर्ण परतावा जमा करण्यात आला आहे.`,
        message_hi: `ऑर्डर #${order.order_number} के लिए ₹${refundAmount.toFixed(2)} का रिफंड जारी किया गया।`,
        link: '/customer/bills'
      });

      NotificationEngine.sendNotification({
        userId: order.provider_user_id,
        type: 'PENALTY',
        soundType: 'notification',
        title_en: 'Delivery Failure Penalty Applied',
        title_mr: 'डिलिव्हरी अयशस्वी दंड आकारला',
        title_hi: 'डिलीवरी विफलता जुर्माना लागू',
        message_en: `Penalty of ₹${providerPenalty.toFixed(2)} and ${penaltyPoints} penalty points applied for Order #${order.order_number}.`,
        message_mr: `ऑर्डर #${order.order_number} साठी ₹${providerPenalty.toFixed(2)} चा दंड आणि ${penaltyPoints} पेनॉल्टी पॉईंट्स आकारले गेले.`,
        message_hi: `ऑर्डर #${order.order_number} के लिए ₹${providerPenalty.toFixed(2)} का जुर्माना और ${penaltyPoints} पेनल्टी पॉइंट्स लागू।`,
        link: '/provider/orders'
      });

      NotificationEngine.notifyAdmins({
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Delivery Failed',
        title_mr: 'डिलिव्हरी अयशस्वी',
        title_hi: 'डिलीवरी विफल',
        message_en: `Order #${order.order_number} failed delivery. Customer refunded ₹${refundAmount.toFixed(2)}.`,
        message_mr: `ऑर्डर #${order.order_number} डिलिव्हरी अयशस्वी. ग्राहकाला ₹${refundAmount.toFixed(2)} परतावा दिला.`,
        message_hi: `ऑर्डर #${order.order_number} डिलीवरी विफल। ग्राहक को ₹${refundAmount.toFixed(2)} रिफंड किया गया।`,
        link: '/admin/orders'
      });

      // 5. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'ORDER_DELIVERY_FAILED', 'ORDER', ?, ?)
      `).run(
        uuidv4(),
        adminOrSystemId,
        orderId,
        JSON.stringify({ refundAmount, providerPenalty, penaltyPoints })
      );
    });

    txn();

    return {
      orderId,
      refundAmount,
      providerPenalty,
      penaltyPoints,
      status: 'FAILED'
    };
  }
}

module.exports = CancellationEngine;
