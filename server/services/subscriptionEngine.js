const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const NotificationEngine = require('./notificationEngine');

/**
 * Smart Subscription Engine for Aapna Tiffin
 * Implements authoritative calendar-month arithmetic, subscription date-level tracking,
 * dynamic status resolution, and date-level cancellation logic.
 */
class SubscriptionEngine {
  /**
   * Authoritative Calendar Date Calculation for Subscriptions
   * Rule for Monthly:
   * - Start Date = Actual subscription activation date
   * - End Date = Same calendar date in following month - 1 day
   * - Correctly handles 28/29-day February, 30/31-day months, leap years, and month-end clamping.
   *
   * Examples:
   * - 11/10/2026 -> 10/11/2026 (1 month)
   * - 05/01/2027 -> 04/02/2027 (1 month)
   * - 31/01/2026 -> Clamped to 28/02/2026 - 1 day = 27/02/2026
   */
  static calculateSubscriptionEndDate(startDateStr, planType) {
    if (!startDateStr) {
      startDateStr = new Date().toISOString().split('T')[0];
    }
    
    // Parse YYYY-MM-DD safely
    const parts = startDateStr.split('-').map(p => parseInt(p, 10));
    const startYear = parts[0];
    const startMonth = parts[1] - 1; // 0-indexed month
    const startDay = parts[2];

    const startDate = new Date(Date.UTC(startYear, startMonth, startDay));

    if (planType === 'SINGLE') {
      return startDateStr;
    }

    if (planType === 'WEEKLY') {
      // 7 days inclusive: start date + 6 days
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      return endDate.toISOString().split('T')[0];
    }

    if (planType === 'MONTHLY') {
      // Target month is month + 1
      const targetYear = startMonth === 11 ? startYear + 1 : startYear;
      const targetMonth = (startMonth + 1) % 12;

      // Determine days in target month (by checking day 0 of month + 1)
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

      // Clamp startDay if target month has fewer days (e.g. Jan 31 -> Feb 28/29)
      const clampedDay = Math.min(startDay, daysInTargetMonth);

      const nextMonthSameDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
      // Subtract 1 day for inclusive end date (e.g. Oct 11 -> Nov 11 - 1 = Nov 10)
      nextMonthSameDate.setUTCDate(nextMonthSameDate.getUTCDate() - 1);

      return nextMonthSameDate.toISOString().split('T')[0];
    }

    return startDateStr;
  }

  /**
   * Helper to generate array of ISO date strings [YYYY-MM-DD] between start and end date inclusive
   */
  static getDatesBetween(startDateStr, endDateStr) {
    const dates = [];
    const partsStart = startDateStr.split('-').map(p => parseInt(p, 10));
    const partsEnd = endDateStr.split('-').map(p => parseInt(p, 10));

    let current = new Date(Date.UTC(partsStart[0], partsStart[1] - 1, partsStart[2]));
    const end = new Date(Date.UTC(partsEnd[0], partsEnd[1] - 1, partsEnd[2]));

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  /**
   * Pre-generate date-specific subscription_meals records when a subscription is activated
   */
  static generateSubscriptionMeals(subscriptionId, orderId, providerId, planType, mealType, startDateStr, endDateStr, extraRotiUnits = 0, txDb = db) {
    const dates = this.getDatesBetween(startDateStr, endDateStr);
    const slots = [];
    if (mealType === 'LUNCH' || mealType === 'BOTH') slots.push('LUNCH');
    if (mealType === 'DINNER' || mealType === 'BOTH') slots.push('DINNER');

    // Fetch existing provider menu items to create realistic menu snapshots
    const menuItems = txDb.prepare(`
      SELECT name, description, meal_type, price, is_speciality
      FROM menu_items
      WHERE provider_id = ?
    `).all(providerId);

    const lunchMenu = menuItems.filter(m => m.meal_type === 'LUNCH');
    const dinnerMenu = menuItems.filter(m => m.meal_type === 'DINNER');

    for (const d of dates) {
      for (const slot of slots) {
        const availableItems = slot === 'LUNCH' ? lunchMenu : dinnerMenu;
        let menuSnapshot = [];

        if (availableItems.length > 0) {
          menuSnapshot = availableItems.map(item => ({
            name: item.name,
            description: item.description,
            isSpeciality: item.is_speciality === 1
          }));
        } else {
          // Default wholesome homestyle menu snapshot
          menuSnapshot = slot === 'LUNCH'
            ? [
                { name: 'Dal Tadka & Steamed Basmati Rice', description: 'Yellow lentils tempered with garlic and cumin', isSpeciality: true },
                { name: 'Seasonal Vegetable Sabzi + 4 Phulkas', description: 'Freshly prepared homestyle sabzi with soft whole wheat rotis', isSpeciality: false },
                { name: 'Fresh Salad & Roasted Papad', description: 'Cucumber, carrot, lemon salad', isSpeciality: false }
              ]
            : [
                { name: 'Paneer Butter Masala / Mix Veg Curry', description: 'Rich spiced gravy with desi ghee', isSpeciality: true },
                { name: '4 Whole Wheat Chapatis + Jeera Rice', description: 'Soft piping hot chapatis with cumin rice', isSpeciality: false },
                { name: 'Boondi Raita / Pickle', description: 'Spiced curd with crispy boondi', isSpeciality: false }
              ];
        }

        const mealRecordId = uuidv4();
        txDb.prepare(`
          INSERT INTO subscription_meals (
            id, subscription_id, meal_date, meal_type, order_id, menu_snapshot,
            extra_roti_quantity, status, delivery_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', 'PENDING')
        `).run(
          mealRecordId,
          subscriptionId,
          d,
          slot,
          orderId,
          JSON.stringify(menuSnapshot),
          extraRotiUnits
        );
      }
    }
  }

  /**
   * Get Authoritative Subscription Calendar & Summary
   */
  static getSubscriptionCalendar(subscriptionId, customerId) {
    const subscription = db.prepare(`
      SELECT s.*, p.provider_name, p.kitchen_name, p.food_type, p.mobile as provider_mobile,
             o.order_number, o.final_amount, o.delivery_otp as order_delivery_otp
      FROM subscriptions s
      JOIN provider_profiles p ON s.provider_id = p.id
      JOIN orders o ON s.order_id = o.id
      WHERE s.id = ? AND s.customer_id = ?
    `).get(subscriptionId, customerId);

    if (!subscription) {
      throw new Error('Subscription not found or access denied');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    // Fetch all subscription_meals
    const mealRows = db.prepare(`
      SELECT sm.*, o.order_status as linked_order_status, o.delivery_otp as linked_order_otp
      FROM subscription_meals sm
      LEFT JOIN orders o ON sm.order_id = o.id
      WHERE sm.subscription_id = ?
      ORDER BY sm.meal_date ASC, sm.meal_type ASC
    `).all(subscriptionId);

    // Group meals by date
    const dateMap = {};
    let deliveredCount = 0;
    let cancelledCount = 0;
    let totalMealsCount = mealRows.length;

    for (const row of mealRows) {
      const d = row.meal_date;
      if (!dateMap[d]) {
        dateMap[d] = {
          date: d,
          isToday: d === todayStr,
          isTomorrow: d === tomorrowStr,
          isYesterday: d === yesterdayStr,
          isPast: d < todayStr,
          isFuture: d > todayStr,
          meals: []
        };
      }

      // Compute dynamic, authoritative status
      let resolvedStatus = row.status;
      let displayStatus = 'CONFIRMED';
      let deliveryOtp = row.delivery_otp || row.linked_order_otp || subscription.order_delivery_otp;

      if (row.cancellation_status) {
        resolvedStatus = 'CANCELLED';
        displayStatus = 'CANCELLED';
        cancelledCount++;
      } else if (row.delivery_status === 'DELIVERED' || row.status === 'DELIVERED') {
        resolvedStatus = 'DELIVERED';
        displayStatus = 'DELIVERED';
        deliveredCount++;
      } else if (d === todayStr) {
        // Check today's active order status
        const currentStatus = row.linked_order_status || 'PREPARING';
        if (currentStatus === 'DELIVERED') {
          resolvedStatus = 'DELIVERED';
          displayStatus = 'DELIVERED';
          deliveredCount++;
        } else if (['READY', 'EN_ROUTE'].includes(currentStatus)) {
          resolvedStatus = 'EN_ROUTE';
          displayStatus = 'EN_ROUTE';
        } else if (currentStatus === 'PREPARING') {
          resolvedStatus = 'PREPARING';
          displayStatus = 'PREPARING';
        } else if (currentStatus === 'CANCELLED') {
          resolvedStatus = 'CANCELLED';
          displayStatus = 'CANCELLED';
          cancelledCount++;
        } else {
          resolvedStatus = 'CONFIRMED';
          displayStatus = 'CONFIRMED';
        }
      } else if (d < todayStr) {
        // Past date
        if (row.status === 'CANCELLED') {
          resolvedStatus = 'CANCELLED';
          displayStatus = 'CANCELLED';
          cancelledCount++;
        } else {
          resolvedStatus = 'DELIVERED';
          displayStatus = 'DELIVERED';
          deliveredCount++;
        }
      } else {
        // Future date
        if (row.status === 'CANCELLED') {
          resolvedStatus = 'CANCELLED';
          displayStatus = 'CANCELLED';
          cancelledCount++;
        } else {
          resolvedStatus = 'CONFIRMED';
          displayStatus = 'CONFIRMED';
        }
      }

      let parsedMenu = [];
      if (d === todayStr && !row.cancellation_status) {
        // Today's Menu: check live daily menu items from database first, fallback to snapshot
        try {
          const liveTodayItems = db.prepare(`
            SELECT name, description, is_speciality, price, food_type
            FROM menu_items
            WHERE provider_id = ? AND menu_date = ? AND meal_type = ?
          `).all(subscription.provider_id, todayStr, row.meal_type);

          if (liveTodayItems.length > 0) {
            parsedMenu = liveTodayItems.map(item => ({
              name: item.name,
              description: item.description,
              isSpeciality: item.is_speciality === 1,
              price: item.price,
              foodType: item.food_type
            }));
          } else if (row.menu_snapshot) {
            parsedMenu = JSON.parse(row.menu_snapshot);
          }
        } catch (e) {
          parsedMenu = [];
        }
      } else if (d < todayStr && displayStatus === 'DELIVERED' && !row.cancellation_status) {
        // Past Delivered Date: show delivered menu snapshot
        try {
          parsedMenu = row.menu_snapshot ? JSON.parse(row.menu_snapshot) : [];
        } catch (e) {
          parsedMenu = [];
        }
      } else {
        // Future dates OR cancelled meals: provider arranges menu daily, future menus are never returned
        parsedMenu = [];
      }

      dateMap[d].meals.push({
        id: row.id,
        mealType: row.meal_type,
        status: resolvedStatus,
        displayStatus: displayStatus,
        extraRoti: row.extra_roti_quantity || 0,
        menuSnapshot: parsedMenu,
        cancellationStatus: row.cancellation_status,
        cancellationReason: row.cancellation_reason,
        cancellationTime: row.cancellation_time,
        refundAmount: row.refund_amount || 0.0,
        deliveryStatus: row.delivery_status,
        deliveryTime: row.delivery_time,
        deliveryOtp: deliveryOtp,
        deliveryProofUrl: row.delivery_proof_url,
        orderId: row.order_id
      });
    }

    // Filter calendar dates: show ONLY days that have already occurred PLUS TODAY (Future dates are completely hidden)
    const calendarDates = Object.values(dateMap)
      .filter(d => d.date <= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Summary calculation
    const totalLunch = subscription.total_lunch || 0;
    const totalDinner = subscription.total_dinner || 0;
    const totalMeals = totalMealsCount || (totalLunch + totalDinner);
    const usedMeals = deliveredCount;
    const remainingMeals = Math.max(0, totalMeals - usedMeals - cancelledCount);

    const lunchMeals = mealRows.filter(m => m.meal_type === 'LUNCH');
    const dinnerMeals = mealRows.filter(m => m.meal_type === 'DINNER');

    const usedLunch = lunchMeals.filter(m => m.delivery_status === 'DELIVERED' || m.status === 'DELIVERED' || (m.meal_date < todayStr && !m.cancellation_status)).length;
    const cancelledLunch = lunchMeals.filter(m => m.cancellation_status).length;
    const remainingLunch = Math.max(0, totalLunch - usedLunch - cancelledLunch);

    const usedDinner = dinnerMeals.filter(m => m.delivery_status === 'DELIVERED' || m.status === 'DELIVERED' || (m.meal_date < todayStr && !m.cancellation_status)).length;
    const cancelledDinner = dinnerMeals.filter(m => m.cancellation_status).length;
    const remainingDinner = Math.max(0, totalDinner - usedDinner - cancelledDinner);

    return {
      subscription: {
        id: subscription.id,
        orderId: subscription.order_id,
        orderNumber: subscription.order_number,
        providerId: subscription.provider_id,
        providerName: subscription.provider_name,
        kitchenName: subscription.kitchen_name,
        foodType: subscription.food_type,
        providerMobile: subscription.provider_mobile,
        planType: subscription.plan_type,
        mealType: subscription.meal_type,
        startDate: subscription.start_date,
        endDate: subscription.expiry_date,
        status: subscription.status,
        extraRotiPerMeal: subscription.extra_roti_per_meal,
        totalMeals,
        usedMeals,
        remainingMeals,
        totalLunch,
        usedLunch,
        remainingLunch,
        totalDinner,
        usedDinner,
        remainingDinner
      },
      calendarDates
    };
  }

  /**
   * Get Specific Date Details
   */
  static getSubscriptionDateDetails(subscriptionId, customerId, mealDate) {
    const calendar = this.getSubscriptionCalendar(subscriptionId, customerId);
    const dateItem = calendar.calendarDates.find(d => d.date === mealDate);
    if (!dateItem) {
      throw new Error(`No scheduled subscription meal found for date: ${mealDate}`);
    }

    return {
      subscription: calendar.subscription,
      dateDetails: dateItem
    };
  }

  /**
   * Cancel a Specific Subscription Date / Meal Slot
   */
  static cancelSubscriptionDate(subscriptionId, customerId, mealDate, mealType, reason = 'Customer cancelled date') {
    const sub = db.prepare(`
      SELECT s.*, c.user_id as customer_user_id, p.user_id as provider_user_id,
             p.provider_name, p.kitchen_name, o.final_amount, o.order_number
      FROM subscriptions s
      JOIN customer_profiles c ON s.customer_id = c.id
      JOIN provider_profiles p ON s.provider_id = p.id
      JOIN orders o ON s.order_id = o.id
      WHERE s.id = ? AND s.customer_id = ?
    `).get(subscriptionId, customerId);

    if (!sub) {
      throw new Error('Subscription not found or access denied');
    }

    const mealRecord = db.prepare(`
      SELECT * FROM subscription_meals
      WHERE subscription_id = ? AND meal_date = ? AND meal_type = ?
    `).get(subscriptionId, mealDate, mealType);

    if (!mealRecord) {
      throw new Error(`Meal record not found for date ${mealDate} and type ${mealType}`);
    }

    if (mealRecord.status === 'CANCELLED' || mealRecord.cancellation_status) {
      throw new Error(`Meal on ${mealDate} (${mealType}) is already cancelled`);
    }

    if (mealRecord.delivery_status === 'DELIVERED' || mealRecord.status === 'DELIVERED') {
      throw new Error(`Cannot cancel a meal that was already delivered`);
    }

    // Calculate per-meal refund
    const totalMealsCount = (sub.total_lunch + sub.total_dinner) || 1;
    const perMealAmount = Math.round((sub.final_amount / totalMealsCount) * 100) / 100;
    const refundAmount = perMealAmount;

    const txn = db.transaction(() => {
      // 1. Update subscription_meals
      db.prepare(`
        UPDATE subscription_meals
        SET status = 'CANCELLED',
            cancellation_status = 'CANCELLED_BY_CUSTOMER',
            cancellation_reason = ?,
            cancellation_time = CURRENT_TIMESTAMP,
            refund_amount = ?,
            delivery_status = 'CANCELLED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason, refundAmount, mealRecord.id);

      // 2. Create Refund Record
      db.prepare(`
        INSERT INTO payments (id, order_id, customer_id, provider_id, amount, payment_method, gateway, gateway_txn_id, status)
        VALUES (?, ?, ?, ?, ?, 'REFUND', 'Razorpay Mock', ?, 'REFUNDED')
      `).run(uuidv4(), sub.order_id, sub.customer_id, sub.provider_id, refundAmount, `REF-DATE-${Date.now()}`);

      // 3. Notify Provider
      NotificationEngine.sendNotification({
        userId: sub.provider_user_id,
        type: 'SUBSCRIPTION',
        soundType: 'notification',
        title_en: 'Subscription Meal Cancelled',
        title_mr: 'सबस्क्रिप्शन जेवण रद्द केले',
        title_hi: 'सब्सक्रिप्शन भोजन रद्द किया गया',
        message_en: `Customer cancelled ${mealType} for ${mealDate} (Sub #${sub.order_number}). Reason: ${reason}`,
        message_mr: `ग्राहकाने ${mealDate} रोजीचे ${mealType} रद्द केले (सबस्क्रिप्शन #${sub.order_number}). कारण: ${reason}`,
        message_hi: `ग्राहक ने ${mealDate} का ${mealType} रद्द किया (सब्सक्रिप्शन #${sub.order_number})। कारण: ${reason}`,
        link: '/provider/orders'
      });

      // 4. Notify Customer
      NotificationEngine.sendNotification({
        userId: sub.customer_user_id,
        type: 'SUBSCRIPTION',
        soundType: 'notification',
        title_en: 'Meal Date Cancellation Confirmed',
        title_mr: 'जेवण तारीख रद्द झाल्याची पुष्टी',
        title_hi: 'भोजन की तारीख रद्द करने की पुष्टि',
        message_en: `Cancelled ${mealType} for ${mealDate}. Refund of ₹${refundAmount.toFixed(2)} processed to your account.`,
        message_mr: `${mealDate} चे ${mealType} रद्द केले. ₹${refundAmount.toFixed(2)} चा परतावा खात्यात जमा करण्यात आला आहे.`,
        message_hi: `${mealDate} का ${mealType} रद्द किया गया। ₹${refundAmount.toFixed(2)} का रिफंड आपके खाते में प्रोसेस किया गया।`,
        link: '/customer/dashboard'
      });

      if (refundAmount > 0) {
        NotificationEngine.sendNotification({
          userId: sub.customer_user_id,
          type: 'PAYMENT',
          soundType: 'payment',
          title_en: 'Refund Processed for Meal',
          title_mr: 'जेवणाचा परतावा जमा झाला',
          title_hi: 'भोजन का रिफंड प्रोसेस हुआ',
          message_en: `Refund of ₹${refundAmount.toFixed(2)} processed for ${mealType} on ${mealDate}.`,
          message_mr: `${mealDate} च्या ${mealType} साठी ₹${refundAmount.toFixed(2)} परतावा जमा झाला.`,
          message_hi: `${mealDate} के ${mealType} के लिए ₹${refundAmount.toFixed(2)} रिफंड मिला।`,
          link: '/customer/bills'
        });
      }

      // 5. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
        VALUES (?, ?, 'CUSTOMER_SUBSCRIPTION_DATE_CANCELLED', 'SUBSCRIPTION_MEAL', ?, ?)
      `).run(
        uuidv4(),
        sub.customer_user_id,
        mealRecord.id,
        JSON.stringify({ subscriptionId, mealDate, mealType, refundAmount, reason })
      );
    });

    txn();

    return {
      success: true,
      mealDate,
      mealType,
      refundAmount,
      status: 'CANCELLED'
    };
  }

  /**
   * Pause a subscription until a specified date
   */
  static pauseSubscription(subId, customerId, resumeDate) {
    const sub = db.prepare(`
      SELECT s.*, p.user_id as provider_user_id, c.user_id as customer_user_id
      FROM subscriptions s
      JOIN provider_profiles p ON s.provider_id = p.id
      JOIN customer_profiles c ON s.customer_id = c.id
      WHERE s.id = ? AND s.customer_id = ?
    `).get(subId, customerId);

    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'ACTIVE') throw new Error(`Cannot pause subscription with status ${sub.status}`);

    db.prepare(`
      UPDATE subscriptions
      SET status = 'PAUSED',
          paused_until = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(resumeDate, subId);

    NotificationEngine.sendNotification({
      userId: sub.customer_user_id,
      type: 'SUBSCRIPTION',
      soundType: 'notification',
      title_en: 'Subscription Paused',
      title_mr: 'सबस्क्रिप्शन थांबवले',
      title_hi: 'सब्सक्रिप्शन रोका गया',
      message_en: `Your ${sub.plan_type} subscription has been paused until ${resumeDate || 'further notice'}.`,
      message_mr: `तुमचे ${sub.plan_type} सबस्क्रिप्शन ${resumeDate || 'पुढील सूचनेपर्यंत'} थांबवले गेले आहे.`,
      message_hi: `आपका ${sub.plan_type} सब्सक्रिप्शन ${resumeDate || 'अगली सूचना तक'} रोक दिया गया है।`,
      link: '/customer/subscriptions'
    });

    NotificationEngine.sendNotification({
      userId: sub.provider_user_id,
      type: 'SUBSCRIPTION',
      soundType: 'notification',
      title_en: 'Customer Paused Subscription',
      title_mr: 'ग्राहकाने सबस्क्रिप्शन थांबवले',
      title_hi: 'ग्राहक ने सब्सक्रिप्शन रोका',
      message_en: `Customer paused their ${sub.plan_type} subscription until ${resumeDate || 'further notice'}.`,
      message_mr: `ग्राहकाने त्यांचे ${sub.plan_type} सबस्क्रिप्शन थांबवले आहे.`,
      message_hi: `ग्राहक ने अपना ${sub.plan_type} सब्सक्रिप्शन रोक दिया है।`,
      link: '/provider/orders'
    });

    return db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(subId);
  }

  /**
   * Resume a paused subscription
   */
  static resumeSubscription(subId, customerId) {
    const sub = db.prepare(`
      SELECT s.*, p.user_id as provider_user_id, c.user_id as customer_user_id
      FROM subscriptions s
      JOIN provider_profiles p ON s.provider_id = p.id
      JOIN customer_profiles c ON s.customer_id = c.id
      WHERE s.id = ? AND s.customer_id = ?
    `).get(subId, customerId);

    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'PAUSED') throw new Error(`Subscription is not paused`);

    db.prepare(`
      UPDATE subscriptions
      SET status = 'ACTIVE',
          paused_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(subId);

    NotificationEngine.sendNotification({
      userId: sub.customer_user_id,
      type: 'SUBSCRIPTION',
      soundType: 'notification',
      title_en: 'Subscription Resumed',
      title_mr: 'सबस्क्रिप्शन पुन्हा सुरू झाले',
      title_hi: 'सब्सक्रिप्शन फिर से शुरू हुआ',
      message_en: `Your ${sub.plan_type} subscription is now active again!`,
      message_mr: `तुमचे ${sub.plan_type} सबस्क्रिप्शन आता पुन्हा सुरू झाले आहे!`,
      message_hi: `आपका ${sub.plan_type} सब्सक्रिप्शन फिर से सक्रिय हो गया है!`,
      link: '/customer/subscriptions'
    });

    NotificationEngine.sendNotification({
      userId: sub.provider_user_id,
      type: 'SUBSCRIPTION',
      soundType: 'notification',
      title_en: 'Customer Resumed Subscription',
      title_mr: 'ग्राहकाने सबस्क्रिप्शन पुन्हा सुरू केले',
      title_hi: 'ग्राहक ने सब्सक्रिप्शन फिर से शुरू किया',
      message_en: `Customer resumed their ${sub.plan_type} subscription.`,
      message_mr: `ग्राहकाने त्यांचे ${sub.plan_type} सबस्क्रिप्शन पुन्हा सुरू केले.`,
      message_hi: `ग्राहक ने अपना ${sub.plan_type} सब्सक्रिप्शन फिर से शुरू किया।`,
      link: '/provider/orders'
    });

    return db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(subId);
  }
}

module.exports = SubscriptionEngine;
