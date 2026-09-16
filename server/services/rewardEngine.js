const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const NotificationEngine = require('./notificationEngine');

/**
 * Customer Points Ledger & Milestone Reward Engine (100 Points -> 1 Free 1-Day Meal)
 */
class RewardEngine {
  /**
   * Get current points balance and rewards for a customer
   */
  static getCustomerPointsSummary(customerId) {
    const pointsRow = db.prepare(`
      SELECT COALESCE(SUM(points_change), 0) as total_points
      FROM customer_points_ledger
      WHERE customer_id = ?
    `).get(customerId);

    const totalPoints = pointsRow ? pointsRow.total_points : 0;

    const history = db.prepare(`
      SELECT * FROM customer_points_ledger
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `).all(customerId);

    const rewards = db.prepare(`
      SELECT * FROM customer_rewards
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `).all(customerId);

    return {
      totalPoints,
      pointsHistory: history,
      rewards
    };
  }

  /**
   * Award points to customer and check for milestone rewards (every 100 points)
   */
  static awardPoints(customerId, points, reason, orderId = null) {
    if (!customerId || !points || points <= 0) return null;

    const summary = this.getCustomerPointsSummary(customerId);
    const newBalance = summary.totalPoints + points;

    const txn = db.transaction(() => {
      // 1. Insert into ledger
      db.prepare(`
        INSERT INTO customer_points_ledger (id, customer_id, order_id, points_change, reason, balance_after)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), customerId, orderId, points, reason, newBalance);

      // 2. Check milestone: every 100 points
      const oldMilestoneCount = Math.floor(summary.totalPoints / 100);
      const newMilestoneCount = Math.floor(newBalance / 100);

      if (newMilestoneCount > oldMilestoneCount) {
        const milestoneVal = newMilestoneCount * 100;
        
        // Check if already awarded this milestone
        const existingReward = db.prepare(`
          SELECT id FROM customer_rewards 
          WHERE customer_id = ? AND milestone_points = ?
        `).get(customerId, milestoneVal);

        if (!existingReward) {
          // Generate unique reward code
          const rewardCode = `FREE-MEAL-${milestoneVal}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          db.prepare(`
            INSERT INTO customer_rewards (id, customer_id, milestone_points, reward_code, reward_type, free_meal_value, is_redeemed, provider_reimbursement_amount)
            VALUES (?, ?, ?, ?, 'FREE_1_DAY_MEAL', 110.00, 0, 110.00)
          `).run(uuidv4(), customerId, milestoneVal, rewardCode);

          // Get customer user_id for notification
          const cust = db.prepare(`SELECT user_id FROM customer_profiles WHERE id = ?`).get(customerId);
          if (cust) {
            NotificationEngine.sendNotification({
              userId: cust.user_id,
              type: 'REWARD',
              soundType: 'notification',
              title_en: '🎉 Congratulations! Free 1-Day Meal Reward Unlocked',
              title_mr: '🎉 अभिनंदन! मोफत १-दिवसाचा डबा व्हाउचर अनलॉक झाले',
              title_hi: '🎉 बधाई हो! 1-दिन का मुफ्त टिफिन रिवॉर्ड अनलॉक हुआ',
              message_en: `You earned ${milestoneVal} points! Use voucher code ${rewardCode} for a free 1-Day meal.`,
              message_mr: `तुम्ही ${milestoneVal} पॉइंट्स मिळवले आहेत! मोफत १-दिवसाच्या डब्यासाठी व्हाउचर कोड ${rewardCode} वापरा.`,
              message_hi: `आपने ${milestoneVal} पॉइंट्स कमाए! मुफ्त 1-दिन के टिफिन के लिए वाउचर कोड ${rewardCode} का उपयोग करें।`,
              link: '/customer/points'
            });
          }
        }
      }
    });

    txn();
    return this.getCustomerPointsSummary(customerId);
  }

  /**
   * Redeem a Free Meal reward voucher during checkout
   */
  static redeemVoucher(customerId, rewardCode, orderId) {
    const reward = db.prepare(`
      SELECT * FROM customer_rewards
      WHERE customer_id = ? AND reward_code = ? AND is_redeemed = 0
    `).get(customerId, rewardCode);

    if (!reward) {
      throw new Error('Invalid or already redeemed reward voucher code');
    }

    db.prepare(`
      UPDATE customer_rewards
      SET is_redeemed = 1,
          redeemed_order_id = ?,
          redeemed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId, reward.id);

    return {
      success: true,
      discountAmount: reward.free_meal_value,
      rewardId: reward.id
    };
  }
}

module.exports = RewardEngine;
