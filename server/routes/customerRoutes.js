const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const OTPEngine = require('../services/otpEngine');
const CancellationEngine = require('../services/cancellationEngine');
const CommissionEngine = require('../services/commissionEngine');
const RewardEngine = require('../services/rewardEngine');
const SubscriptionEngine = require('../services/subscriptionEngine');
const GeofenceEngine = require('../services/geofenceEngine');
const NotificationEngine = require('../services/notificationEngine');

// Customer-only middleware
router.use(authenticateJWT, requireRole('CUSTOMER'));

/**
 * Helper to get customer ID from authenticated user
 */
function getCustomerId(req) {
  const profile = db.prepare(`SELECT id FROM customer_profiles WHERE user_id = ?`).get(req.user.id);
  if (!profile) throw new Error('Customer profile not found');
  return profile.id;
}

/**
 * GET /api/customer/location - Get customer's saved current delivery location
 */
router.get('/location', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const location = db.prepare(`
      SELECT * FROM customer_locations 
      WHERE customer_id = ? AND is_current = 1
      ORDER BY updated_at DESC LIMIT 1
    `).get(customerId);

    const profile = db.prepare(`SELECT * FROM customer_profiles WHERE id = ?`).get(customerId);

    return res.json({
      location: location || null,
      fallbackAddress: profile?.delivery_address || 'Nagpur / Pune, Maharashtra'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/customer/location - Save / Update customer's active delivery location
 */
router.post('/location', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { latitude, longitude, address, city, area, postal_code } = req.body;

    if (latitude === undefined || longitude === undefined || !address) {
      return res.status(400).json({ error: 'Latitude, longitude, and address are required.' });
    }

    const numLat = parseFloat(latitude);
    const numLon = parseFloat(longitude);
    if (isNaN(numLat) || isNaN(numLon)) {
      return res.status(400).json({ error: 'Valid numeric coordinates are required.' });
    }

    // Set existing records to is_current = 0
    db.prepare(`UPDATE customer_locations SET is_current = 0 WHERE customer_id = ?`).run(customerId);

    // Insert new current location
    const locId = uuidv4();
    db.prepare(`
      INSERT INTO customer_locations (id, customer_id, latitude, longitude, address, city, area, postal_code, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(locId, customerId, numLat, numLon, address.trim(), city || 'Pune', area || '', postal_code || '');

    // Also update customer_profiles delivery_address
    db.prepare(`UPDATE customer_profiles SET delivery_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(address.trim(), customerId);

    return res.json({
      success: true,
      message: 'Delivery location updated successfully.',
      location: {
        id: locId,
        customer_id: customerId,
        latitude: numLat,
        longitude: numLon,
        address: address.trim(),
        city: city || 'Pune',
        area: area || '',
        postal_code: postal_code || '',
        is_current: 1
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customer/providers-by-location - Authoritative Server-Side Geofenced Provider Matching
 * Matches customer location with provider service radius and returns two separate sections:
 * 1. servingYourLocation (inside service radius)
 * 2. otherAvailableProviders (outside service radius)
 */
router.get('/providers-by-location', (req, res) => {
  try {
    const { lat, lon, date, food_type, sort_by } = req.query;
    
    // If no coordinates passed, check if customer has a saved current location
    let customerLat = lat;
    let customerLon = lon;

    if (customerLat === undefined || customerLon === undefined) {
      const customerId = getCustomerId(req);
      const savedLoc = db.prepare(`
        SELECT latitude, longitude FROM customer_locations 
        WHERE customer_id = ? AND is_current = 1
        ORDER BY updated_at DESC LIMIT 1
      `).get(customerId);

      if (savedLoc) {
        customerLat = savedLoc.latitude;
        customerLon = savedLoc.longitude;
      }
    }

    const result = GeofenceEngine.getProvidersForCustomerLocation({
      customerLat,
      customerLon,
      targetDate: date,
      foodType: food_type,
      sortBy: sort_by
    });

    return res.json(result);
  } catch (err) {
    console.error('[CUSTOMER PROVIDERS BY LOCATION ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customer/providers - Discover home chefs / providers (legacy / fallback)
 */
router.get('/providers', (req, res) => {
  const { food_type, sort_by } = req.query;

  let query = `
    SELECT p.*, pp.single_meal_lunch_price, pp.single_meal_dinner_price, 
           pp.weekly_lunch_sub_price, pp.monthly_lunch_sub_price, pp.extra_roti_unit_price
    FROM provider_profiles p
    LEFT JOIN provider_pricing pp ON p.id = pp.provider_id
    WHERE p.is_open = 1
  `;

  const params = [];
  if (food_type && food_type !== 'ALL') {
    query += ` AND p.food_type = ?`;
    params.push(food_type);
  }

  if (sort_by === 'RATING_HIGH') {
    query += ` ORDER BY p.rating_avg DESC`;
  } else if (sort_by === 'PRICE_LOW') {
    query += ` ORDER BY pp.single_meal_lunch_price ASC`;
  } else if (sort_by === 'PRICE_HIGH') {
    query += ` ORDER BY pp.single_meal_lunch_price DESC`;
  } else {
    query += ` ORDER BY p.rating_avg DESC, p.created_at DESC`;
  }

  const providers = db.prepare(query).all(...params);
  return res.json({ providers });
});

/**
 * GET /api/customer/providers/:id - Full Provider Page
 */
router.get('/providers/:id', (req, res) => {
  const provider = db.prepare(`
    SELECT p.*, pp.single_meal_lunch_price, pp.single_meal_dinner_price, 
           pp.weekly_lunch_sub_price, pp.weekly_both_sub_price,
           pp.monthly_lunch_sub_price, pp.monthly_both_sub_price,
           pp.extra_roti_unit_price, f.has_fssai, f.fssai_number
    FROM provider_profiles p
    LEFT JOIN provider_pricing pp ON p.id = pp.provider_id
    LEFT JOIN provider_fssai_details f ON p.id = f.provider_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  // Today's Menu
  const today = new Date().toISOString().split('T')[0];
  const todaysMenu = db.prepare(`
    SELECT * FROM menu_items
    WHERE provider_id = ? AND menu_date = ?
    ORDER BY is_speciality DESC, price ASC
  `).all(req.params.id, today);

  // Previous Menu History
  const menuHistory = db.prepare(`
    SELECT menu_date, meal_type, GROUP_CONCAT(name, ' • ') as dishes
    FROM menu_items
    WHERE provider_id = ? AND menu_date < ?
    GROUP BY menu_date, meal_type
    ORDER BY menu_date DESC
    LIMIT 10
  `).all(req.params.id, today);

  // Preparation Frequency (Individual Specific Food Items with Frequency)
  const rawPrepFrequency = db.prepare(`
    SELECT name, meal_type, SUM(prep_count) as total_preps
    FROM menu_items
    WHERE provider_id = ?
    GROUP BY name
    ORDER BY total_preps DESC
    LIMIT 8
  `).all(req.params.id);

  function getFrequencyLabel(count) {
    const c = count || 0;
    if (c >= 50) return 'Daily';
    if (c >= 40) return '5 times/week';
    if (c >= 30) return '4 times/week';
    if (c >= 20) return '3 times/week';
    if (c >= 10) return '2 times/week';
    return 'Weekly';
  }

  const prepFrequency = rawPrepFrequency.map(item => ({
    ...item,
    frequency: getFrequencyLabel(item.total_preps)
  }));

  // Reviews
  const reviews = db.prepare(`
    SELECT r.*, c.full_name as customer_name
    FROM ratings_reviews r
    JOIN customer_profiles c ON r.customer_id = c.id
    WHERE r.provider_id = ?
    ORDER BY r.created_at DESC
    LIMIT 15
  `).all(req.params.id);

  // Location Coverage Calculation
  const { lat, lon } = req.query;
  let coverage = null;
  if (lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
    const cov = GeofenceEngine.isLocationWithinProviderServiceArea(req.params.id, parseFloat(lat), parseFloat(lon));
    coverage = {
      isServingLocation: cov.isWithinRadius,
      distanceKm: cov.distanceKm,
      radiusKm: cov.radiusKm
    };
  }

  return res.json({
    provider,
    todaysMenu,
    menuHistory,
    prepFrequency,
    reviews,
    coverage
  });
});

/**
 * POST /api/customer/orders - Create Meal / Subscription Order
 * Enforces 3-hour minimum ordering rule server-side.
 */
router.post('/orders', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const {
      provider_id,
      meal_type = 'LUNCH', // 'LUNCH', 'DINNER', 'BOTH'
      plan_type = 'SINGLE', // 'SINGLE', 'WEEKLY', 'MONTHLY'
      extra_roti_count = 0,
      special_instructions = '',
      voucher_code = null,
      payment_method = 'UPI',
      delivery_lat = null,
      delivery_lon = null,
      delivery_address = null,
      menu_item_id = null,
      quantity = 1
    } = req.body;

    const provider = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(provider_id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    if (provider.is_open !== 1) return res.status(400).json({ error: 'Kitchen is currently closed for orders.' });

    const pricing = db.prepare(`SELECT * FROM provider_pricing WHERE provider_id = ?`).get(provider_id);
    if (!pricing) return res.status(400).json({ error: 'Provider pricing not configured.' });

    // If specific Today's Fresh Special menu item is ordered directly
    let selectedMenuItem = null;
    if (menu_item_id) {
      selectedMenuItem = db.prepare(`
        SELECT * FROM menu_items WHERE id = ? AND provider_id = ? AND is_available = 1
      `).get(menu_item_id, provider_id);
    }

    // Enforce 3-hour minimum ordering window rule
    // e.g. Lunch is delivered around 12:30 PM (must order before 9:30 AM for today, or order for tomorrow)
    const now = new Date();
    let scheduledDelivery = new Date();
    const effectiveMealType = selectedMenuItem ? selectedMenuItem.meal_type : meal_type;
    
    if (effectiveMealType === 'LUNCH') {
      scheduledDelivery.setHours(13, 0, 0, 0); // 1:00 PM
      if (scheduledDelivery.getTime() - now.getTime() < 3 * 60 * 60 * 1000) {
        // If less than 3 hours, schedule for tomorrow's lunch
        scheduledDelivery.setDate(scheduledDelivery.getDate() + 1);
      }
    } else if (effectiveMealType === 'DINNER') {
      scheduledDelivery.setHours(20, 0, 0, 0); // 8:00 PM
      if (scheduledDelivery.getTime() - now.getTime() < 3 * 60 * 60 * 1000) {
        scheduledDelivery.setDate(scheduledDelivery.getDate() + 1);
      }
    } else {
      scheduledDelivery.setHours(13, 0, 0, 0);
      if (scheduledDelivery.getTime() - now.getTime() < 3 * 60 * 60 * 1000) {
        scheduledDelivery.setDate(scheduledDelivery.getDate() + 1);
      }
    }

    // Authoritative Server-Side Geofence Validation Recheck
    let targetLat = delivery_lat;
    let targetLon = delivery_lon;
    let targetAddr = delivery_address;

    if (targetLat === null || targetLat === undefined || targetLon === null || targetLon === undefined) {
      const savedLoc = db.prepare(`
        SELECT * FROM customer_locations WHERE customer_id = ? AND is_current = 1 ORDER BY updated_at DESC LIMIT 1
      `).get(customerId);
      if (savedLoc) {
        targetLat = savedLoc.latitude;
        targetLon = savedLoc.longitude;
        targetAddr = targetAddr || savedLoc.address;
      }
    }

    if (!targetAddr) {
      const profile = db.prepare(`SELECT delivery_address FROM customer_profiles WHERE id = ?`).get(customerId);
      targetAddr = profile?.delivery_address || 'Delivery Address';
    }

    if (targetLat !== null && targetLat !== undefined && targetLon !== null && targetLon !== undefined) {
      const serviceDate = scheduledDelivery.toISOString().split('T')[0];
      const coverage = GeofenceEngine.isLocationWithinProviderServiceArea(provider_id, targetLat, targetLon, serviceDate);
      if (!coverage.isWithinRadius) {
        return res.status(400).json({
          error: `Selected provider does not deliver to your address (${coverage.distanceKm} KM away, provider service radius is ${coverage.radiusKm} KM). Please select a provider serving your location.`
        });
      }
    }

    // Base Price Calculation
    let baseAmount = 0.0;
    let numMeals = 1;
    const itemQty = Math.max(1, parseInt(quantity) || 1);

    if (selectedMenuItem) {
      baseAmount = parseFloat(selectedMenuItem.price) * itemQty;
      numMeals = itemQty;
    } else if (plan_type === 'SINGLE') {
      baseAmount = meal_type === 'DINNER' ? pricing.single_meal_dinner_price : pricing.single_meal_lunch_price;
      numMeals = 1;
    } else if (plan_type === 'WEEKLY') {
      baseAmount = meal_type === 'BOTH' ? pricing.weekly_both_sub_price : pricing.weekly_lunch_sub_price;
      numMeals = meal_type === 'BOTH' ? 14 : 7;
    } else if (plan_type === 'MONTHLY') {
      baseAmount = meal_type === 'BOTH' ? pricing.monthly_both_sub_price : pricing.monthly_lunch_sub_price;
      numMeals = meal_type === 'BOTH' ? 60 : 30;
    }

    const extraRotiUnits = parseInt(extra_roti_count) || 0;
    const extraRotiAmount = extraRotiUnits * (pricing.extra_roti_unit_price || 10.0) * (plan_type === 'SINGLE' ? 1 : (plan_type === 'WEEKLY' ? 7 : 30));

    let discountAmount = 0.0;
    let redeemedReward = null;

    // Validate and Apply Voucher if provided
    if (voucher_code) {
      const reward = db.prepare(`
        SELECT * FROM customer_rewards 
        WHERE customer_id = ? AND reward_code = ? AND is_redeemed = 0
      `).get(customerId, voucher_code.trim());

      if (reward) {
        discountAmount = reward.free_meal_value;
        redeemedReward = reward;
      }
    }

    const grossAmount = baseAmount + extraRotiAmount;
    const finalPayable = Math.max(0, grossAmount - discountAmount);

    // Commission split
    const split = CommissionEngine.calculateOrderSplit(grossAmount);
    const orderId = uuidv4();
    const orderNumber = `APT-${Date.now().toString().slice(-6)}`;
    const deliveryOtp = OTPEngine.generateOTP();
    const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const planMealName = selectedMenuItem 
      ? `${selectedMenuItem.name} (Fresh Special)` 
      : `${plan_type} Tiffin Plan`;

    const txn = db.transaction(() => {
      // 1. Create Order (Automatically Accepted upon successful creation & payment)
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, provider_id, meal_type, plan_type, num_meals,
          extra_roti_count, base_amount, extra_roti_amount, discount_amount, final_amount,
          order_status, payment_status, delivery_otp, delivery_scheduled_time, special_instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 'SUCCESS', ?, ?, ?)
      `).run(
        orderId, orderNumber, customerId, provider_id, effectiveMealType, plan_type, numMeals,
        extraRotiUnits, baseAmount, extraRotiAmount, discountAmount, finalPayable,
        deliveryOtp, scheduledDelivery.toISOString(), special_instructions
      );

      // 1a. If specific menu item ordered, insert into order_items and update prep count
      if (selectedMenuItem) {
        db.prepare(`
          INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), orderId, selectedMenuItem.id, selectedMenuItem.name, itemQty, selectedMenuItem.price);

        db.prepare(`
          UPDATE menu_items SET prep_count = prep_count + ? WHERE id = ?
        `).run(itemQty, selectedMenuItem.id);
      }

      // 1b. Store Order Delivery Location Snapshot
      if (targetLat !== null && targetLat !== undefined && targetLon !== null && targetLon !== undefined) {
        db.prepare(`
          INSERT INTO order_delivery_locations (id, order_id, latitude, longitude, address, city, area, postal_code)
          VALUES (?, ?, ?, ?, ?, 'Pune', '', '')
        `).run(uuidv4(), orderId, parseFloat(targetLat), parseFloat(targetLon), targetAddr || 'Delivery Address');
      }

      // 2. Create Customer Bill (Immutable financial record)
      db.prepare(`
        INSERT INTO bills (
          id, bill_number, order_id, customer_id, provider_id, bill_type, plan_meal_name,
          meal_slot, extra_roti_count, base_amount, charges, discount, gross_amount,
          final_payable, payment_method, gateway, transaction_id, payment_status
        ) VALUES (?, ?, ?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, 0.00, ?, ?, ?, ?, 'Razorpay Mock', ?, 'SUCCESS')
      `).run(
        uuidv4(), `BILL-CUST-${Date.now().toString().slice(-6)}`, orderId, customerId, provider_id,
        planMealName, effectiveMealType, extraRotiUnits, baseAmount, discountAmount,
        grossAmount, finalPayable, payment_method, txnId
      );

      // 3. Create Provider Bill (Earnings, commission, net payable)
      db.prepare(`
        INSERT INTO bills (
          id, bill_number, order_id, customer_id, provider_id, bill_type, plan_meal_name,
          meal_slot, extra_roti_count, base_amount, charges, discount, gross_amount,
          platform_commission, final_payable, payment_method, gateway, transaction_id, payment_status
        ) VALUES (?, ?, ?, ?, ?, 'PROVIDER', ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, 'Razorpay Mock', ?, 'SUCCESS')
      `).run(
        uuidv4(), `BILL-PROV-${Date.now().toString().slice(-6)}`, orderId, customerId, provider_id,
        planMealName, effectiveMealType, extraRotiUnits, baseAmount,
        grossAmount, split.platformCommission, split.providerPayable, payment_method, txnId
      );

      // 4. Record Payment
      db.prepare(`
        INSERT INTO payments (id, order_id, customer_id, provider_id, amount, payment_method, gateway, gateway_txn_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Razorpay Mock', ?, 'SUCCESS')
      `).run(uuidv4(), orderId, customerId, provider_id, finalPayable, payment_method, txnId);

      // 5. If Subscription, initialize subscription tracker & generate subscription_meals
      if (plan_type !== 'SINGLE') {
        const subId = uuidv4();
        const startDate = scheduledDelivery.toISOString().split('T')[0];
        const expiryDate = SubscriptionEngine.calculateSubscriptionEndDate(startDate, plan_type);

        const subDates = SubscriptionEngine.getDatesBetween(startDate, expiryDate);
        const daysCount = subDates.length;

        const totalLunch = (meal_type === 'LUNCH' || meal_type === 'BOTH') ? daysCount : 0;
        const totalDinner = (meal_type === 'DINNER' || meal_type === 'BOTH') ? daysCount : 0;

        db.prepare(`
          INSERT INTO subscriptions (
            id, customer_id, provider_id, order_id, plan_type, meal_type, start_date, expiry_date,
            total_lunch, used_lunch, total_dinner, used_dinner, extra_roti_per_meal, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'ACTIVE')
        `).run(
          subId, customerId, provider_id, orderId, plan_type, meal_type, startDate,
          expiryDate, totalLunch, totalDinner, extraRotiUnits
        );

        // Pre-generate subscription_meals calendar entries
        SubscriptionEngine.generateSubscriptionMeals(
          subId, orderId, provider_id, plan_type, meal_type, startDate, expiryDate, extraRotiUnits, db
        );
      }

      // 6. Redeem voucher if used
      if (redeemedReward) {
        db.prepare(`
          UPDATE customer_rewards
          SET is_redeemed = 1, redeemed_order_id = ?, redeemed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(orderId, redeemedReward.id);
      }

      // 7. Dispatch Notifications
      const providerUser = db.prepare(`SELECT user_id FROM provider_profiles WHERE id = ?`).get(provider_id);

      // Customer: Payment Success notification (dedicated payment sound)
      NotificationEngine.sendNotification({
        userId: req.user.id,
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Payment Successful',
        title_mr: 'पेमेंट यशस्वी झाले',
        title_hi: 'भुगतान सफल रहा',
        message_en: `Payment of ₹${finalPayable.toFixed(2)} for Order #${orderNumber} (${plan_type}) completed successfully.`,
        message_mr: `ऑर्डर #${orderNumber} साठी ₹${finalPayable.toFixed(2)} चे पेमेंट यशस्वीरित्या पूर्ण झाले.`,
        message_hi: `ऑर्डर #${orderNumber} के लिए ₹${finalPayable.toFixed(2)} का भुगतान सफलतापूर्वक पूरा हुआ।`,
        link: '/customer/bills'
      });

      // Customer: Order Confirmed notification
      NotificationEngine.sendNotification({
        userId: req.user.id,
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'Order Placed Successfully',
        title_mr: 'ऑर्डर यशस्वीरित्या नोंदवली गेली',
        title_hi: 'ऑर्डर सफलतापूर्वक दर्ज हुआ',
        message_en: `Your order #${orderNumber} (${plan_type}, ${meal_type}) has been placed. Delivery OTP: ${deliveryOtp}.`,
        message_mr: `तुमची ऑर्डर #${orderNumber} (${plan_type}, ${meal_type}) नोंदवली गेली आहे. डिलिव्हरी OTP: ${deliveryOtp}.`,
        message_hi: `आपका ऑर्डर #${orderNumber} (${plan_type}, ${meal_type}) दर्ज हो गया है। डिलीवरी OTP: ${deliveryOtp}।`,
        link: '/customer/dashboard'
      });

      if (plan_type !== 'SINGLE') {
        NotificationEngine.sendNotification({
          userId: req.user.id,
          type: 'SUBSCRIPTION',
          soundType: 'notification',
          title_en: 'Subscription Activated',
          title_mr: 'सबस्क्रिप्शन सुरू झाले',
          title_hi: 'सब्सक्रिप्शन सक्रिय हुआ',
          message_en: `Your ${plan_type} subscription has been activated! Manage it from the Subscriptions page.`,
          message_mr: `तुमचे ${plan_type} सबस्क्रिप्शन सुरू झाले आहे! सबस्क्रिप्शन पेजवरून व्यवस्थापित करा.`,
          message_hi: `आपका ${plan_type} सब्सक्रिप्शन शुरू हो गया है! सब्सक्रिप्शन पेज से प्रबंधित करें।`,
          link: '/customer/subscriptions'
        });
      }

      // Provider: Order Received notification
      if (providerUser) {
        NotificationEngine.sendNotification({
          userId: providerUser.user_id,
          type: 'ORDER',
          soundType: 'notification',
          title_en: '🔔 New Order Received!',
          title_mr: '🔔 नवीन ऑर्डर आली आहे!',
          title_hi: '🔔 नया ऑर्डर प्राप्त हुआ!',
          message_en: `New ${plan_type} (${meal_type}) order #${orderNumber}. Total ₹${finalPayable.toFixed(2)}.`,
          message_mr: `नवीन ${plan_type} (${meal_type}) ऑर्डर #${orderNumber}. एकूण रक्कम ₹${finalPayable.toFixed(2)}.`,
          message_hi: `नया ${plan_type} (${meal_type}) ऑर्डर #${orderNumber}. कुल ₹${finalPayable.toFixed(2)}.`,
          link: '/provider/orders'
        });

        if (plan_type !== 'SINGLE') {
          NotificationEngine.sendNotification({
            userId: providerUser.user_id,
            type: 'SUBSCRIPTION',
            soundType: 'notification',
            title_en: '🔔 New Subscription Received!',
            title_mr: '🔔 नवीन सबस्क्रिप्शन मिळाले!',
            title_hi: '🔔 नया सब्सक्रिप्शन मिला!',
            message_en: `Customer subscribed to ${plan_type} (${meal_type}) plan for Order #${orderNumber}.`,
            message_mr: `ऑर्डर #${orderNumber} साठी ग्राहकाने ${plan_type} (${meal_type}) सबस्क्रिप्शन घेतले आहे.`,
            message_hi: `ऑर्डर #${orderNumber} के लिए ग्राहक ने ${plan_type} (${meal_type}) प्लान सब्सक्राइब किया है।`,
            link: '/provider/orders'
          });
        }
      }

      // Admin: Order and Payment notification
      NotificationEngine.notifyAdmins({
        type: 'ORDER',
        soundType: 'notification',
        title_en: 'New Order Placed',
        title_mr: 'नवीन ऑर्डर प्राप्त झाली',
        title_hi: 'नया ऑर्डर प्राप्त हुआ',
        message_en: `Order #${orderNumber} (${plan_type}, ₹${finalPayable.toFixed(2)}) placed.`,
        message_mr: `ऑर्डर #${orderNumber} (${plan_type}, ₹${finalPayable.toFixed(2)}) नोंदवली गेली.`,
        message_hi: `ऑर्डर #${orderNumber} (${plan_type}, ₹${finalPayable.toFixed(2)}) दर्ज हुआ।`,
        link: '/admin/orders'
      });

      NotificationEngine.notifyAdmins({
        type: 'PAYMENT',
        soundType: 'payment',
        title_en: 'Payment Received',
        title_mr: 'पेमेंट प्राप्त झाले',
        title_hi: 'भुगतान प्राप्त हुआ',
        message_en: `Payment of ₹${finalPayable.toFixed(2)} received for Order #${orderNumber}.`,
        message_mr: `ऑर्डर #${orderNumber} साठी ₹${finalPayable.toFixed(2)} पेमेंट प्राप्त झाले.`,
        message_hi: `ऑर्डर #${orderNumber} के लिए ₹${finalPayable.toFixed(2)} भुगतान प्राप्त हुआ।`,
        link: '/admin/finance'
      });
    });

    txn();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        id: orderId,
        orderNumber,
        deliveryOtp,
        finalPayable,
        scheduledDelivery: scheduledDelivery.toISOString()
      }
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Helper to categorize tiffin food items (Dal, Roti, Rice, Sabji, Sides)
 */
function categorizeFoodItem(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('dal') || n.includes('kadhi') || n.includes('rasam') || n.includes('sambar') || n.includes('varan')) return 'Dal';
  if (n.includes('roti') || n.includes('phulka') || n.includes('chapati') || n.includes('bhakri') || n.includes('paratha') || n.includes('puri') || n.includes('poli')) return 'Roti';
  if (n.includes('rice') || n.includes('bhaat') || n.includes('pulao') || n.includes('biryani') || n.includes('khichdi') || n.includes('jeera')) return 'Rice';
  if (n.includes('salad') || n.includes('pickle') || n.includes('raita') || n.includes('papad') || n.includes('thecha') || n.includes('chutney')) return 'Sides';
  if (n.includes('paneer') || n.includes('chicken') || n.includes('sabji') || n.includes('bhaji') || n.includes('aloo') || n.includes('gobi') || n.includes('curry') || n.includes('makhani') || n.includes('masala') || n.includes('bharta') || n.includes('sukka') || n.includes('rassa') || n.includes('matar') || n.includes('chole')) return 'Sabji';
  return 'Speciality';
}

/**
 * Helper to enrich an active order with dynamic today_menu_items and expected delivery time window
 */
function enrichActiveOrder(o) {
  // 1. Calculate Expected Delivery Window based on actual order / schedule
  let expectedDeliveryTime = '1:00 PM – 1:30 PM';
  if (o.delivery_scheduled_time) {
    const schedDate = new Date(o.delivery_scheduled_time);
    if (!isNaN(schedDate.getTime())) {
      const hours = schedDate.getHours();
      const mins = schedDate.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHour = hours % 12 === 0 ? 12 : hours % 12;
      const formattedMins = mins < 10 ? '0' + mins : mins;
      
      const endHours = (hours + (mins >= 30 ? 1 : 0)) % 24;
      const endMins = (mins + 30) % 60;
      const endPeriod = endHours >= 12 ? 'PM' : 'AM';
      const formattedEndHour = endHours % 12 === 0 ? 12 : endHours % 12;
      const formattedEndMins = endMins < 10 ? '0' + endMins : endMins;
      
      expectedDeliveryTime = `${formattedHour}:${formattedMins} ${period} – ${formattedEndHour}:${formattedEndMins} ${endPeriod}`;
    }
  } else {
    expectedDeliveryTime = o.meal_type === 'DINNER' ? '7:30 PM – 8:30 PM' : '12:30 PM – 1:30 PM';
  }

  // 2. Query Actual Today's Menu Items for this order / provider
  let todayMenuItems = [];

  // A. Check order_items table
  const orderItems = db.prepare(`
    SELECT oi.item_name as name, oi.quantity, mi.photo_url, mi.description, mi.is_speciality
    FROM order_items oi
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `).all(o.id);

  if (orderItems && orderItems.length > 0) {
    todayMenuItems = orderItems.map(item => ({
      name: item.name,
      description: item.description || '',
      photo_url: item.photo_url || null,
      is_speciality: item.is_speciality === 1,
      category: categorizeFoodItem(item.name)
    }));
  }

  // B. Check subscription_meals table for today's menu snapshot
  if (todayMenuItems.length === 0) {
    const subMeal = db.prepare(`
      SELECT menu_snapshot, extra_roti_quantity
      FROM subscription_meals
      WHERE (order_id = ? OR subscription_id IN (SELECT id FROM subscriptions WHERE order_id = ? OR customer_id = ? AND provider_id = ?))
        AND meal_date = CURRENT_DATE
      LIMIT 1
    `).get(o.id, o.id, o.customer_id, o.provider_id);

    if (subMeal && subMeal.menu_snapshot) {
      try {
        const parsed = JSON.parse(subMeal.menu_snapshot);
        if (Array.isArray(parsed) && parsed.length > 0) {
          todayMenuItems = parsed.map(item => ({
            name: item.name,
            description: item.description || '',
            photo_url: item.photo_url || null,
            is_speciality: Boolean(item.isSpeciality || item.is_speciality),
            category: categorizeFoodItem(item.name)
          }));
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
  }

  // C. Check provider's menu_items for today
  if (todayMenuItems.length === 0) {
    const providerDishes = db.prepare(`
      SELECT name, description, photo_url, is_speciality, meal_type
      FROM menu_items
      WHERE provider_id = ? AND menu_date = CURRENT_DATE AND is_available = 1
        AND (meal_type = ? OR ? = 'BOTH' OR meal_type = 'LUNCH')
      ORDER BY is_speciality DESC, price ASC
    `).all(o.provider_id, o.meal_type || 'LUNCH', o.meal_type || 'LUNCH');

    if (providerDishes && providerDishes.length > 0) {
      todayMenuItems = providerDishes.map(item => ({
        name: item.name,
        description: item.description || '',
        photo_url: item.photo_url || null,
        is_speciality: item.is_speciality === 1,
        category: categorizeFoodItem(item.name)
      }));
    }
  }

  // D. Wholesome standard fallback if provider has not set today's individual dishes
  if (todayMenuItems.length === 0) {
    const isVeg = o.food_type !== 'Non-Veg';
    const isDinner = o.meal_type === 'DINNER';
    todayMenuItems = [
      { name: isDinner ? 'Dal Makhani' : 'Yellow Dal Tadka', category: 'Dal', description: 'Slow-simmered homestyle lentils' },
      { name: `Fresh Wheat Phulkas (${4 + (o.extra_roti_count || 0)} Pcs)`, category: 'Roti', description: 'Whole wheat soft chapatis with pure ghee' },
      { name: 'Steamed Basmati Rice', category: 'Rice', description: 'Fragrant steamed long-grain rice' },
      { name: isVeg ? 'Seasonal Mix Veg Sabji' : 'Kolhapuri Chicken Gravy', category: 'Sabji', description: 'Freshly prepared homestyle curry' },
      { name: 'Fresh Salad & Lemon Pickle', category: 'Sides', description: 'Crisp cucumber, carrot slices & pickle' }
    ];
  }

  return {
    ...o,
    expected_delivery_time: expectedDeliveryTime,
    today_menu_items: todayMenuItems
  };
}

/**
 * GET /api/customer/dashboard/today - Today's Live Dashboard Bundle
 * Returns active orders, today's delivered meals (delivered today only), and today's menus
 */
router.get('/dashboard/today', (req, res) => {
  try {
    const customerId = getCustomerId(req);

    // 1. Active In-Progress Orders
    const rawActiveOrders = db.prepare(`
      SELECT o.*, p.provider_name, p.kitchen_name, p.mobile as provider_mobile, p.food_type
      FROM orders o
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.customer_id = ? AND o.order_status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')
      ORDER BY o.created_at DESC
    `).all(customerId);

    const activeOrders = rawActiveOrders.map(enrichActiveOrder);

    // 2. Orders Delivered strictly TODAY
    const deliveredTodayOrders = db.prepare(`
      SELECT o.*, p.provider_name, p.kitchen_name, p.mobile as provider_mobile, p.food_type,
             r.rating, r.review_text
      FROM orders o
      JOIN provider_profiles p ON o.provider_id = p.id
      LEFT JOIN ratings_reviews r ON o.id = r.order_id
      WHERE o.customer_id = ? AND o.order_status = 'DELIVERED'
        AND (DATE(o.updated_at) = CURRENT_DATE OR DATE(o.delivery_scheduled_time) = CURRENT_DATE OR DATE(o.created_at) = CURRENT_DATE)
      ORDER BY o.updated_at DESC
    `).all(customerId);

    // 3. Today's Curated Fresh Menus from Active Providers strictly serving customer's location
    const { lat, lon } = req.query;
    let customerLat = lat !== undefined && lat !== null && !isNaN(parseFloat(lat)) ? parseFloat(lat) : null;
    let customerLon = lon !== undefined && lon !== null && !isNaN(parseFloat(lon)) ? parseFloat(lon) : null;

    if (customerLat === null || customerLon === null) {
      const savedLoc = db.prepare(`
        SELECT latitude, longitude FROM customer_locations 
        WHERE customer_id = ? AND is_current = 1
        ORDER BY updated_at DESC LIMIT 1
      `).get(customerId);
      if (savedLoc) {
        customerLat = savedLoc.latitude;
        customerLon = savedLoc.longitude;
      }
    }

    const allTodayMenus = db.prepare(`
      SELECT m.*, p.kitchen_name, p.provider_name, p.food_type as provider_food_type, p.rating_avg, p.total_reviews,
             p.kitchen_address, pl.latitude as prov_lat, pl.longitude as prov_lon
      FROM menu_items m
      JOIN provider_profiles p ON m.provider_id = p.id
      LEFT JOIN provider_locations pl ON p.id = pl.provider_id
      WHERE m.menu_date = CURRENT_DATE AND m.is_available = 1 AND p.is_open = 1
      ORDER BY m.is_speciality DESC, m.price ASC
    `).all();

    let todaysSpecialMenus = [];
    if (customerLat !== null && customerLon !== null) {
      for (const item of allTodayMenus) {
        const coverage = GeofenceEngine.isLocationWithinProviderServiceArea(item.provider_id, customerLat, customerLon);
        if (coverage.isWithinRadius) {
          todaysSpecialMenus.push({
            ...item,
            distance_km: coverage.distanceKm,
            service_radius_km: coverage.radiusKm,
            serves_location: true
          });
        }
      }
    }

    return res.json({
      activeOrders,
      deliveredTodayOrders,
      todaysSpecialMenus
    });
  } catch (err) {
    console.error('[CUSTOMER DASHBOARD TODAY ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customer/orders/active - Today's Active Order
 */
router.get('/orders/active', (req, res) => {
  const customerId = getCustomerId(req);
  const rawActiveOrders = db.prepare(`
    SELECT o.*, p.provider_name, p.kitchen_name, p.mobile as provider_mobile, p.food_type
    FROM orders o
    JOIN provider_profiles p ON o.provider_id = p.id
    WHERE o.customer_id = ? AND o.order_status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')
    ORDER BY o.created_at DESC
  `).all(customerId);

  const activeOrders = rawActiveOrders.map(enrichActiveOrder);
  return res.json({ activeOrders });
});

/**
 * GET /api/customer/orders - All Customer Orders
 */
router.get('/orders', (req, res) => {
  const customerId = getCustomerId(req);
  const orders = db.prepare(`
    SELECT o.*, p.provider_name, p.kitchen_name, r.rating, r.review_text
    FROM orders o
    JOIN provider_profiles p ON o.provider_id = p.id
    LEFT JOIN ratings_reviews r ON o.id = r.order_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(customerId);

  return res.json({ orders });
});

/**
 * POST /api/customer/orders/:id/cancel - Customer Order Cancellation
 */
router.post('/orders/:id/cancel', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { reason = 'Customer requested cancellation' } = req.body;
    const result = CancellationEngine.processCustomerCancellation(req.params.id, customerId, reason);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/customer/subscriptions
 */
router.get('/subscriptions', (req, res) => {
  const customerId = getCustomerId(req);
  const subscriptions = db.prepare(`
    SELECT s.*, p.provider_name, p.kitchen_name
    FROM subscriptions s
    JOIN provider_profiles p ON s.provider_id = p.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `).all(customerId);

  return res.json({ subscriptions });
});

/**
 * GET /api/customer/subscriptions/active-calendar - Convenience endpoint to get active subscription calendar
 */
router.get('/subscriptions/active-calendar', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const activeSub = db.prepare(`
      SELECT id FROM subscriptions
      WHERE customer_id = ? AND status IN ('ACTIVE', 'PAUSED')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(customerId);

    if (!activeSub) {
      return res.json({ subscription: null, calendarDates: [] });
    }

    const calendarData = SubscriptionEngine.getSubscriptionCalendar(activeSub.id, customerId);
    return res.json(calendarData);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/customer/subscriptions/:id/calendar - Full Subscription Calendar
 */
router.get('/subscriptions/:id/calendar', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const calendarData = SubscriptionEngine.getSubscriptionCalendar(req.params.id, customerId);
    return res.json(calendarData);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/customer/subscriptions/:id/calendar/:date - Specific Date Details
 */
router.get('/subscriptions/:id/calendar/:date', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const dateDetails = SubscriptionEngine.getSubscriptionDateDetails(req.params.id, customerId, req.params.date);
    return res.json(dateDetails);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/customer/subscriptions/:id/cancel-date - Cancel Specific Date / Meal Slot
 */
router.post('/subscriptions/:id/cancel-date', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { meal_date, meal_type = 'LUNCH', reason = 'Customer cancelled date' } = req.body;
    if (!meal_date) return res.status(400).json({ error: 'meal_date is required' });

    const result = SubscriptionEngine.cancelSubscriptionDate(req.params.id, customerId, meal_date, meal_type, reason);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/customer/subscriptions/:id/pause
 */
router.post('/subscriptions/:id/pause', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { resume_date } = req.body;
    const updated = SubscriptionEngine.pauseSubscription(req.params.id, customerId, resume_date);
    return res.json({ success: true, subscription: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/customer/subscriptions/:id/resume
 */
router.post('/subscriptions/:id/resume', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const updated = SubscriptionEngine.resumeSubscription(req.params.id, customerId);
    return res.json({ success: true, subscription: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/customer/bills - Dedicated immutable Financial Bills section
 */
router.get('/bills', (req, res) => {
  const customerId = getCustomerId(req);
  const bills = db.prepare(`
    SELECT b.*, o.order_number, p.provider_name, p.kitchen_name
    FROM bills b
    JOIN orders o ON b.order_id = o.id
    JOIN provider_profiles p ON b.provider_id = p.id
    WHERE b.customer_id = ? AND b.bill_type = 'CUSTOMER'
    ORDER BY b.created_at DESC
  `).all(customerId);

  return res.json({ bills });
});

/**
 * GET /api/customer/points - Customer Points Ledger & Milestone Rewards
 */
router.get('/points', (req, res) => {
  const customerId = getCustomerId(req);
  const summary = RewardEngine.getCustomerPointsSummary(customerId);
  return res.json(summary);
});

/**
 * POST /api/customer/reviews - Rate completed order & earn points
 */
router.post('/reviews', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { order_id, rating, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    }

    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? AND customer_id = ?
    `).get(order_id, customerId);

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.order_status !== 'DELIVERED') {
      return res.status(400).json({ error: 'You can only review delivered orders.' });
    }

    const existing = db.prepare(`SELECT id FROM ratings_reviews WHERE order_id = ?`).get(order_id);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this order.' });
    }

    const txn = db.transaction(() => {
      // 1. Insert review
      db.prepare(`
        INSERT INTO ratings_reviews (id, order_id, customer_id, provider_id, rating, review_text, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?, 5)
      `).run(uuidv4(), order_id, customerId, order.provider_id, parseInt(rating), review_text || '');

      // 2. Award 5 bonus points to customer
      RewardEngine.awardPoints(customerId, 5, `Review for Order #${order.order_number}`, order_id);

      // 3. Recalculate provider average rating strictly based on actual reviews
      const avgRow = db.prepare(`
        SELECT AVG(rating) as avg_r, COUNT(*) as cnt
        FROM ratings_reviews
        WHERE provider_id = ?
      `).get(order.provider_id);

      const totalReviews = avgRow ? avgRow.cnt : 0;
      const averageRating = totalReviews > 0 ? Math.round(avgRow.avg_r * 10) / 10 : 0.0;

      db.prepare(`
        UPDATE provider_profiles
        SET rating_avg = ?, total_reviews = ?
        WHERE id = ?
      `).run(averageRating, totalReviews, order.provider_id);
    });

    txn();

    return res.status(201).json({
      success: true,
      message: 'Thank you for your review! +5 Points awarded.',
      pointsAwarded: 5
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/customer/chat - List conversations with providers
 */
router.get('/chat', (req, res) => {
  const customerId = getCustomerId(req);
  const conversations = db.prepare(`
    SELECT c.*, p.provider_name, p.kitchen_name,
           (SELECT message_text FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
    FROM chat_conversations c
    JOIN provider_profiles p ON c.provider_id = p.id
    WHERE c.customer_id = ?
    ORDER BY c.updated_at DESC
  `).all(customerId);

  return res.json({ conversations });
});

/**
 * POST /api/customer/chat - Start new chat conversation
 */
router.post('/chat', (req, res) => {
  const customerId = getCustomerId(req);
  const { provider_id, topic, custom_subject, initial_message } = req.body;

  if (!provider_id || !topic) {
    return res.status(400).json({ error: 'Provider and topic are required.' });
  }

  const convId = uuidv4();
  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO chat_conversations (id, customer_id, provider_id, topic, custom_subject)
      VALUES (?, ?, ?, ?, ?)
    `).run(convId, customerId, provider_id, topic, custom_subject || null);

    if (initial_message) {
      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, sender_id, sender_role, message_text)
        VALUES (?, ?, ?, 'CUSTOMER', ?)
      `).run(uuidv4(), convId, req.user.id, initial_message);
    }
  });

  txn();
  return res.status(201).json({ success: true, conversationId: convId });
});

/**
 * GET /api/customer/chat/:id/messages
 */
router.get('/chat/:id/messages', (req, res) => {
  const customerId = getCustomerId(req);
  const conv = db.prepare(`SELECT * FROM chat_conversations WHERE id = ? AND customer_id = ?`).get(req.params.id, customerId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare(`
    SELECT * FROM chat_messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);

  return res.json({ conversation: conv, messages });
});

/**
 * POST /api/customer/chat/:id/messages
 */
router.post('/chat/:id/messages', (req, res) => {
  const customerId = getCustomerId(req);
  const { message_text } = req.body;
  if (!message_text || !message_text.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const conv = db.prepare(`SELECT * FROM chat_conversations WHERE id = ? AND customer_id = ?`).get(req.params.id, customerId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const msgId = uuidv4();
  db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, sender_id, sender_role, message_text)
    VALUES (?, ?, ?, 'CUSTOMER', ?)
  `).run(msgId, req.params.id, req.user.id, message_text.trim());

  db.prepare(`UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);

  return res.json({ success: true, messageId: msgId });
});

/**
 * Complaints
 */
router.get('/complaints', (req, res) => {
  const complaints = db.prepare(`
    SELECT c.*, o.order_number
    FROM complaints c
    LEFT JOIN orders o ON c.order_id = o.id
    WHERE c.reporter_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  return res.json({ complaints });
});

router.post('/complaints', (req, res) => {
  const { order_id, category, description } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: 'Category and description are required.' });
  }

  let reportedUserId = null;
  if (order_id) {
    const order = db.prepare(`SELECT p.user_id FROM orders o JOIN provider_profiles p ON o.provider_id = p.id WHERE o.id = ?`).get(order_id);
    if (order) reportedUserId = order.user_id;
  }

  const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO complaints (id, ticket_number, reporter_id, reported_id, order_id, category, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
  `).run(uuidv4(), ticketNumber, req.user.id, reportedUserId, order_id || null, category, description);

  return res.status(201).json({ success: true, ticketNumber, message: 'Complaint registered successfully.' });
});

/**
 * Notifications
 */
router.get('/notifications', (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(req.user.id);
  return res.json({ notifications });
});

router.put('/notifications/:id/read', (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  return res.json({ success: true });
});

/**
 * GET /api/customer/profile - Full profile with stats
 */
router.get('/profile', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const profile = db.prepare(`SELECT * FROM customer_profiles WHERE id = ?`).get(customerId);
    const user = db.prepare(`SELECT id, email, role, preferred_language, created_at FROM users WHERE id = ?`).get(req.user.id);
    const activeOrdersCount = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND order_status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')`).get(customerId)?.count || 0;
    const totalOrdersCount = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE customer_id = ?`).get(customerId)?.count || 0;
    const activeSubsCount = db.prepare(`SELECT COUNT(*) as count FROM subscriptions WHERE customer_id = ? AND status = 'ACTIVE'`).get(customerId)?.count || 0;
    const pointsRow = db.prepare(`SELECT COALESCE(SUM(points_change), 0) as total_points FROM customer_points_ledger WHERE customer_id = ?`).get(customerId);
    const availablePoints = pointsRow ? pointsRow.total_points : 0;

    return res.json({
      user,
      profile,
      stats: {
        activeOrdersCount,
        totalOrdersCount,
        activeSubsCount,
        availablePoints
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/customer/profile - Update full_name, mobile, delivery_address
 */
router.put('/profile', (req, res) => {
  try {
    const customerId = getCustomerId(req);
    const { full_name, mobile, delivery_address, preferred_language } = req.body;

    if (!full_name || !mobile) {
      return res.status(400).json({ error: 'Full name and mobile number are required.' });
    }

    db.prepare(`
      UPDATE customer_profiles 
      SET full_name = ?, mobile = ?, delivery_address = COALESCE(?, delivery_address), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(full_name, mobile, delivery_address, customerId);

    if (preferred_language && ['en', 'mr', 'hi'].includes(preferred_language)) {
      db.prepare(`UPDATE users SET preferred_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(preferred_language, req.user.id);
    }

    const updatedProfile = db.prepare(`SELECT * FROM customer_profiles WHERE id = ?`).get(customerId);
    const updatedUser = db.prepare(`SELECT id, email, role, preferred_language FROM users WHERE id = ?`).get(req.user.id);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser,
      profile: updatedProfile
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
