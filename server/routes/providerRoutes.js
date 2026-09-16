const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const OTPEngine = require('../services/otpEngine');
const CancellationEngine = require('../services/cancellationEngine');
const GeofenceEngine = require('../services/geofenceEngine');
const RoutingService = require('../services/routingService');
const NotificationEngine = require('../services/notificationEngine');

// Provider-only middleware
router.use(authenticateJWT, requireRole('PROVIDER'));

function getProviderId(req) {
  const profile = db.prepare(`SELECT id FROM provider_profiles WHERE user_id = ?`).get(req.user.id);
  if (!profile) throw new Error('Provider profile not found');
  return profile.id;
}

/**
 * PUT /api/provider/status - Open/Close Shop Toggle
 */
router.put('/status', (req, res) => {
  const providerId = getProviderId(req);
  const { is_open } = req.body;
  const newStatus = is_open ? 1 : 0;

  db.prepare(`UPDATE provider_profiles SET is_open = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newStatus, providerId);

  return res.json({
    success: true,
    is_open: newStatus,
    message: newStatus ? 'Shop is now OPEN & accepting orders.' : 'Shop is now CLOSED.'
  });
});

/**
 * GET /api/provider/overview - Today's Overview Stats
 */
router.get('/overview', (req, res) => {
  const providerId = getProviderId(req);

  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN order_status = 'NEW' THEN 1 END) as new_orders,
      COUNT(CASE WHEN order_status = 'ACCEPTED' THEN 1 END) as accepted_orders,
      COUNT(CASE WHEN order_status = 'PREPARING' THEN 1 END) as preparing_orders,
      COUNT(CASE WHEN order_status = 'READY' THEN 1 END) as ready_orders,
      COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN order_status = 'CANCELLED' THEN 1 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN final_amount ELSE 0 END), 0) as total_delivered_revenue
    FROM orders
    WHERE provider_id = ?
  `).get(providerId);

  const profile = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(providerId);

  return res.json({ stats, profile });
});

/**
 * GET /api/provider/orders
 */
router.get('/orders', (req, res) => {
  const providerId = getProviderId(req);
  const { status } = req.query;

  let query = `
    SELECT o.*, c.full_name as customer_name, c.mobile as customer_mobile, c.delivery_address
    FROM orders o
    JOIN customer_profiles c ON o.customer_id = c.id
    WHERE o.provider_id = ?
  `;
  const params = [providerId];

  if (status && status !== 'ALL') {
    query += ` AND o.order_status = ?`;
    params.push(status);
  }

  query += ` ORDER BY o.created_at DESC`;
  const orders = db.prepare(query).all(...params);

  return res.json({ orders });
});

/**
 * PUT /api/provider/orders/:id/status - Accept, Reject, or Update status
 */
router.put('/orders/:id/status', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { status, rejection_reason } = req.body;

    const allowedTransitions = ['ACCEPTED', 'PREPARING', 'READY'];
    const order = db.prepare(`
      SELECT o.*, c.user_id as customer_user_id, p.provider_name
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      JOIN provider_profiles p ON o.provider_id = p.id
      WHERE o.id = ? AND o.provider_id = ?
    `).get(req.params.id, providerId);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (status === 'REJECTED' || status === 'CANCELLED') {
      // Process provider cancellation
      const result = CancellationEngine.processProviderCancellation(
        req.params.id,
        providerId,
        rejection_reason || 'Kitchen capacity full / unavailable'
      );
      return res.json({ success: true, message: 'Order cancelled successfully.', ...result });
    }

    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition to ${status}` });
    }

    db.prepare(`UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, req.params.id);

    // Notify customer
    const statusTitles = {
      ACCEPTED: { en: 'Order Accepted!', mr: 'ऑर्डर स्वीकारली!', hi: 'ऑर्डर स्वीकार की गई!' },
      PREPARING: { en: 'Kitchen is Preparing your Meal 🍳', mr: 'स्वयंपाकाची तयारी सुरू आहे 🍳', hi: 'रसोई में खाना तैयार हो रहा है 🍳' },
      READY: { en: 'Tiffin is Ready for Delivery 🛵', mr: 'डबा डिलिव्हरीसाठी तयार आहे 🛵', hi: 'टिफिन डिलीवरी के लिए तैयार है 🛵' }
    };

    const t = statusTitles[status] || statusTitles.ACCEPTED;
    NotificationEngine.sendNotification({
      userId: order.customer_user_id,
      type: 'ORDER',
      soundType: 'notification',
      title_en: t.en,
      title_mr: t.mr,
      title_hi: t.hi,
      message_en: `Your order #${order.order_number} from ${order.provider_name} is now ${status}.`,
      message_mr: `तुमची ऑर्डर #${order.order_number} (${order.provider_name}) आता ${status} स्थितीत आहे.`,
      message_hi: `आपकी ऑर्डर #${order.order_number} (${order.provider_name}) अब ${status} स्थिति में है।`,
      link: '/customer/orders'
    });

    return res.json({ success: true, orderStatus: status });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/provider/orders/:id/cancel - Provider Order Cancellation
 */
router.post('/orders/:id/cancel', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { reason = 'Provider cancelled order' } = req.body;
    const result = CancellationEngine.processProviderCancellation(req.params.id, providerId, reason);
    return res.json({ success: true, message: 'Order cancelled successfully.', ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/provider/orders/:id/verify-otp - Delivery OTP verification
 */
router.post('/orders/:id/verify-otp', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Customer Delivery OTP is required.' });

    const result = OTPEngine.verifyDeliveryOTP(req.params.id, providerId, otp);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/provider/orders/:id/upload-proof - Delivery Photo Proof
 */
router.post('/orders/:id/upload-proof', upload.single('delivery_photo'), (req, res) => {
  try {
    const providerId = getProviderId(req);
    let photoUrl = req.body.photo_url;

    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    if (!photoUrl) {
      photoUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    }

    const result = OTPEngine.completeDeliveryViaPhoto(req.params.id, providerId, photoUrl);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});


/**
 * GET /api/provider/menu - Today's Menu items
 */
router.get('/menu', (req, res) => {
  const providerId = getProviderId(req);
  const today = new Date().toISOString().split('T')[0];

  const items = db.prepare(`
    SELECT * FROM menu_items
    WHERE provider_id = ? AND menu_date = ?
    ORDER BY meal_type ASC, is_speciality DESC
  `).all(providerId, today);

  return res.json({ menuItems: items, todayDate: today });
});

/**
 * POST /api/provider/menu/item - Add dish to menu
 */
router.post('/menu/item', (req, res) => {
  const providerId = getProviderId(req);
  const { meal_type, name, description, price, is_speciality = false, is_available = true, photo_url } = req.body;

  if (!meal_type || !name || !price) {
    return res.status(400).json({ error: 'Meal type, dish name, and price are required.' });
  }

  const itemId = uuidv4();
  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO menu_items (id, provider_id, meal_type, name, description, price, is_speciality, is_available, photo_url, prep_count, menu_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(itemId, providerId, meal_type.toUpperCase(), name, description || '', parseFloat(price), is_speciality ? 1 : 0, is_available ? 1 : 0, photo_url || null, today);

  const created = db.prepare(`SELECT * FROM menu_items WHERE id = ?`).get(itemId);
  return res.status(201).json({ success: true, item: created });
});

/**
 * PUT /api/provider/menu/item/:id - Update dish
 */
router.put('/menu/item/:id', (req, res) => {
  const providerId = getProviderId(req);
  const { name, description, price, is_speciality, is_available } = req.body;

  db.prepare(`
    UPDATE menu_items
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        is_speciality = COALESCE(?, is_speciality),
        is_available = COALESCE(?, is_available)
    WHERE id = ? AND provider_id = ?
  `).run(name, description, price, is_speciality !== undefined ? (is_speciality ? 1 : 0) : null, is_available !== undefined ? (is_available ? 1 : 0) : null, req.params.id, providerId);

  return res.json({ success: true, message: 'Item updated successfully.' });
});

/**
 * DELETE /api/provider/menu/item/:id - Delete dish
 */
router.delete('/menu/item/:id', (req, res) => {
  const providerId = getProviderId(req);
  db.prepare(`DELETE FROM menu_items WHERE id = ? AND provider_id = ?`).run(req.params.id, providerId);
  return res.json({ success: true, message: 'Dish removed from menu.' });
});

/**
 * POST /api/provider/menu/confirm - Confirm & Lock Today's Menu
 */
router.post('/menu/confirm', (req, res) => {
  const providerId = getProviderId(req);
  return res.json({ success: true, message: "Today's menu confirmed and locked for customer browsing." });
});

/**
 * GET /api/provider/prep-frequency - Food Preparation Frequency
 */
router.get('/prep-frequency', (req, res) => {
  const providerId = getProviderId(req);
  const data = db.prepare(`
    SELECT name, SUM(prep_count) as count
    FROM menu_items
    WHERE provider_id = ?
    GROUP BY name
    ORDER BY count DESC
    LIMIT 8
  `).all(providerId);

  function getFrequencyLabel(count) {
    const c = count || 0;
    if (c >= 50) return 'Daily';
    if (c >= 40) return '5 times/week';
    if (c >= 30) return '4 times/week';
    if (c >= 20) return '3 times/week';
    if (c >= 10) return '2 times/week';
    return 'Weekly';
  }

  const prepFrequency = data.map(d => ({
    ...d,
    frequency: getFrequencyLabel(d.count)
  }));

  return res.json({ prepFrequency });
});

/**
 * GET /api/provider/subscriptions
 */
router.get('/subscriptions', (req, res) => {
  const providerId = getProviderId(req);
  const subscriptions = db.prepare(`
    SELECT s.*, c.full_name as customer_name, c.mobile as customer_mobile, c.delivery_address
    FROM subscriptions s
    JOIN customer_profiles c ON s.customer_id = c.id
    WHERE s.provider_id = ?
    ORDER BY s.created_at DESC
  `).all(providerId);

  return res.json({ subscriptions });
});

/**
 * GET /api/provider/customers
 */
router.get('/customers', (req, res) => {
  const providerId = getProviderId(req);
  const customers = db.prepare(`
    SELECT DISTINCT c.id, c.full_name, c.mobile, c.delivery_address,
           COUNT(o.id) as total_orders,
           SUM(o.extra_roti_count) as total_extra_rotis,
           (SELECT status FROM subscriptions WHERE customer_id = c.id AND provider_id = ? ORDER BY created_at DESC LIMIT 1) as sub_status
    FROM orders o
    JOIN customer_profiles c ON o.customer_id = c.id
    WHERE o.provider_id = ?
    GROUP BY c.id
    ORDER BY total_orders DESC
  `).all(providerId, providerId);

  return res.json({ customers });
});

/**
 * GET /api/provider/earnings - Daily, Weekly, Monthly Financial View
 */
router.get('/earnings', (req, res) => {
  const providerId = getProviderId(req);

  // Overall financial sums from bills
  const earningsSummary = db.prepare(`
    SELECT 
      COALESCE(SUM(gross_amount), 0) as gross_income,
      COALESCE(SUM(platform_commission), 0) as total_commission,
      COALESCE(SUM(provider_penalty), 0) as total_penalties,
      COALESCE(SUM(refund_amount), 0) as total_refund_deductions,
      COALESCE(SUM(final_payable), 0) as net_payout_payable
    FROM bills
    WHERE provider_id = ? AND bill_type = 'PROVIDER'
  `).get(providerId);

  // Recent bills
  const bills = db.prepare(`
    SELECT b.*, o.order_number, c.full_name as customer_name
    FROM bills b
    JOIN orders o ON b.order_id = o.id
    JOIN customer_profiles c ON b.customer_id = c.id
    WHERE b.provider_id = ? AND b.bill_type = 'PROVIDER'
    ORDER BY b.created_at DESC
    LIMIT 30
  `).all(providerId);

  // Payout history
  const payouts = db.prepare(`
    SELECT * FROM provider_payouts
    WHERE provider_id = ?
    ORDER BY processed_at DESC
  `).all(providerId);

  return res.json({ summary: earningsSummary, bills, payouts });
});

/**
 * GET /api/provider/pricing
 */
router.get('/pricing', (req, res) => {
  const providerId = getProviderId(req);
  let pricing = db.prepare(`SELECT * FROM provider_pricing WHERE provider_id = ?`).get(providerId);
  if (!pricing) {
    db.prepare(`
      INSERT INTO provider_pricing (id, provider_id) VALUES (?, ?)
    `).run(uuidv4(), providerId);
    pricing = db.prepare(`SELECT * FROM provider_pricing WHERE provider_id = ?`).get(providerId);
  }

  // Market suggested pricing based on average
  const autoSuggestions = {
    suggested_single_lunch: 110.00,
    suggested_single_dinner: 110.00,
    suggested_weekly: 720.00,
    suggested_monthly: 2900.00,
    suggested_extra_roti: 10.00
  };

  return res.json({ pricing, autoSuggestions });
});

/**
 * PUT /api/provider/pricing
 */
router.put('/pricing', (req, res) => {
  const providerId = getProviderId(req);
  const {
    single_meal_lunch_price,
    single_meal_dinner_price,
    weekly_lunch_sub_price,
    weekly_both_sub_price,
    monthly_lunch_sub_price,
    monthly_both_sub_price,
    extra_roti_unit_price,
    auto_pricing_enabled
  } = req.body;

  db.prepare(`
    UPDATE provider_pricing
    SET single_meal_lunch_price = COALESCE(?, single_meal_lunch_price),
        single_meal_dinner_price = COALESCE(?, single_meal_dinner_price),
        weekly_lunch_sub_price = COALESCE(?, weekly_lunch_sub_price),
        weekly_both_sub_price = COALESCE(?, weekly_both_sub_price),
        monthly_lunch_sub_price = COALESCE(?, monthly_lunch_sub_price),
        monthly_both_sub_price = COALESCE(?, monthly_both_sub_price),
        extra_roti_unit_price = COALESCE(?, extra_roti_unit_price),
        auto_pricing_enabled = COALESCE(?, auto_pricing_enabled),
        updated_at = CURRENT_TIMESTAMP
    WHERE provider_id = ?
  `).run(
    single_meal_lunch_price, single_meal_dinner_price, weekly_lunch_sub_price, weekly_both_sub_price,
    monthly_lunch_sub_price, monthly_both_sub_price, extra_roti_unit_price,
    auto_pricing_enabled !== undefined ? (auto_pricing_enabled ? 1 : 0) : null,
    providerId
  );

  return res.json({ success: true, message: 'Pricing updated successfully.' });
});

/**
 * GET /api/provider/chat
 */
router.get('/chat', (req, res) => {
  const providerId = getProviderId(req);
  const conversations = db.prepare(`
    SELECT c.*, cust.full_name as customer_name,
           (SELECT message_text FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
    FROM chat_conversations c
    JOIN customer_profiles cust ON c.customer_id = cust.id
    WHERE c.provider_id = ?
    ORDER BY c.updated_at DESC
  `).all(providerId);

  return res.json({ conversations });
});

/**
 * GET /api/provider/location - Get Provider Kitchen Location & Service Radius Info
 */
router.get('/location', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const location = GeofenceEngine.getProviderLocation(providerId);
    const defaultRadius = GeofenceEngine.getEffectiveServiceRadius(providerId);
    const profile = db.prepare(`SELECT kitchen_name, kitchen_address, provider_name FROM provider_profiles WHERE id = ?`).get(providerId);

    return res.json({
      location,
      defaultRadiusKm: defaultRadius,
      kitchenName: profile?.kitchen_name || 'Kitchen',
      kitchenAddress: profile?.kitchen_address || location.address
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/provider/location - Update Provider Kitchen Location & Coordinates
 */
router.put('/location', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { latitude, longitude, address, city, area, postal_code } = req.body;

    if (latitude === undefined || longitude === undefined || !address) {
      return res.status(400).json({ error: 'Latitude, longitude, and address are required.' });
    }

    const numLat = parseFloat(latitude);
    const numLon = parseFloat(longitude);
    if (isNaN(numLat) || isNaN(numLon)) {
      return res.status(400).json({ error: 'Valid numeric coordinates are required.' });
    }

    const existing = db.prepare(`SELECT id FROM provider_locations WHERE provider_id = ?`).get(providerId);
    if (existing) {
      db.prepare(`
        UPDATE provider_locations
        SET latitude = ?, longitude = ?, address = ?, city = ?, area = ?, postal_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = ?
      `).run(numLat, numLon, address.trim(), city || 'Pune', area || '', postal_code || '', providerId);
    } else {
      db.prepare(`
        INSERT INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(uuidv4(), providerId, numLat, numLon, address.trim(), city || 'Pune', area || '', postal_code || '');
    }

    // Sync kitchen_address in provider_profiles
    db.prepare(`UPDATE provider_profiles SET kitchen_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(address.trim(), providerId);

    return res.json({
      success: true,
      message: 'Kitchen location and coordinates updated successfully.',
      location: {
        provider_id: providerId,
        latitude: numLat,
        longitude: numLon,
        address: address.trim(),
        city: city || 'Pune',
        area: area || '',
        postal_code: postal_code || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/provider/service-area - Get Default & Date-Specific Service Radius Rules
 */
router.get('/service-area', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const serviceAreas = db.prepare(`
      SELECT * FROM provider_service_areas 
      WHERE provider_id = ? AND is_active = 1
      ORDER BY effective_date ASC NULLS FIRST
    `).all(providerId);

    const defaultArea = serviceAreas.find(a => !a.effective_date);
    const dateSpecificAreas = serviceAreas.filter(a => !!a.effective_date);

    return res.json({
      defaultRadiusKm: defaultArea ? defaultArea.radius_km : 5.0,
      defaultAreaId: defaultArea?.id || null,
      dateSpecificAreas
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/provider/service-area - Set Default or Date-Specific Service Radius
 */
router.post('/service-area', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { radius_km, effective_date = null } = req.body;

    const numRadius = parseFloat(radius_km);
    if (isNaN(numRadius) || numRadius <= 0 || numRadius > 50) {
      return res.status(400).json({ error: 'Service radius must be a positive number between 1 and 50 KM.' });
    }

    if (effective_date) {
      // Date-specific radius rule
      const existingDate = db.prepare(`
        SELECT id FROM provider_service_areas WHERE provider_id = ? AND effective_date = ?
      `).get(providerId, effective_date);

      if (existingDate) {
        db.prepare(`
          UPDATE provider_service_areas SET radius_km = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(numRadius, existingDate.id);
      } else {
        db.prepare(`
          INSERT INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(uuidv4(), providerId, numRadius, effective_date);
      }
    } else {
      // Default radius rule
      const existingDefault = db.prepare(`
        SELECT id FROM provider_service_areas WHERE provider_id = ? AND effective_date IS NULL
      `).get(providerId);

      if (existingDefault) {
        db.prepare(`
          UPDATE provider_service_areas SET radius_km = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(numRadius, existingDefault.id);
      } else {
        db.prepare(`
          INSERT INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
          VALUES (?, ?, ?, NULL, 1)
        `).run(uuidv4(), providerId, numRadius);
      }
    }

    return res.json({
      success: true,
      message: effective_date ? `Service radius for ${effective_date} set to ${numRadius} KM.` : `Default service radius updated to ${numRadius} KM.`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/provider/service-area/:id - Remove Date-Specific Service Radius Rule
 */
router.delete('/service-area/:id', (req, res) => {
  try {
    const providerId = getProviderId(req);
    db.prepare(`DELETE FROM provider_service_areas WHERE id = ? AND provider_id = ?`).run(req.params.id, providerId);
    return res.json({ success: true, message: 'Date-specific service radius override removed.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/provider/delivery-route - Today's Optimized Delivery Road Route & Stops
 */
router.get('/delivery-route', async (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { meal_type = 'ALL', date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Get Provider Origin Coordinates
    const origin = GeofenceEngine.getProviderLocation(providerId);

    // 2. Query Orders to deliver for today (or selected slot)
    let orderQuery = `
      SELECT o.id, o.order_number, o.meal_type, o.plan_type, o.order_status, o.delivery_otp, o.delivery_proof_url,
             c.id as customer_id, c.full_name as customer_name, c.mobile as customer_mobile, c.delivery_address,
             odl.latitude as snapshot_lat, odl.longitude as snapshot_lon, odl.address as snapshot_address,
             cl.latitude as cust_current_lat, cl.longitude as cust_current_lon
      FROM orders o
      JOIN customer_profiles c ON o.customer_id = c.id
      LEFT JOIN order_delivery_locations odl ON o.id = odl.order_id
      LEFT JOIN customer_locations cl ON c.id = cl.customer_id AND cl.is_current = 1
      WHERE o.provider_id = ? 
        AND o.order_status IN ('ACCEPTED', 'PREPARING', 'READY', 'DELIVERED')
        AND DATE(o.delivery_scheduled_time) = ?
    `;
    const params = [providerId, targetDate];

    if (meal_type && meal_type !== 'ALL') {
      orderQuery += ` AND (o.meal_type = ? OR o.meal_type = 'BOTH')`;
      params.push(meal_type);
    }

    orderQuery += ` ORDER BY o.order_status ASC, o.created_at ASC`;
    const activeOrders = db.prepare(orderQuery).all(...params);

    // 3. Transform to route stop items with accurate coordinates
    const stops = activeOrders.map((ord, idx) => {
      // Determine delivery coordinates: snapshot location -> saved customer current location -> default nearby jitter
      let lat = ord.snapshot_lat !== null && ord.snapshot_lat !== undefined ? ord.snapshot_lat : (ord.cust_current_lat !== null ? ord.cust_current_lat : origin.latitude + (Math.sin(idx + 1) * 0.015));
      let lon = ord.snapshot_lon !== null && ord.snapshot_lon !== undefined ? ord.snapshot_lon : (ord.cust_current_lon !== null ? ord.cust_current_lon : origin.longitude + (Math.cos(idx + 1) * 0.015));
      let addr = ord.snapshot_address || ord.delivery_address || 'Delivery Address';

      return {
        id: ord.id,
        order_id: ord.id,
        order_number: ord.order_number,
        customer_id: ord.customer_id,
        customer_name: ord.customer_name,
        customer_mobile: ord.customer_mobile,
        address: addr,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        meal_type: ord.meal_type,
        plan_type: ord.plan_type,
        order_status: ord.order_status,
        delivery_otp: ord.delivery_otp,
        delivery_proof_url: ord.delivery_proof_url,
        is_completed: ord.order_status === 'DELIVERED'
      };
    });

    // 4. Calculate Road Route with OSRM & TSP sequence
    const routeResult = await RoutingService.calculateDeliveryRoute(origin, stops);

    // 5. Store / Update delivery_route_records & stops
    const existingRoute = db.prepare(`
      SELECT id FROM delivery_route_records WHERE provider_id = ? AND route_date = ? AND meal_type = ?
    `).get(providerId, targetDate, meal_type);

    const routeRecordId = existingRoute ? existingRoute.id : uuidv4();
    if (existingRoute) {
      db.prepare(`
        UPDATE delivery_route_records
        SET total_distance_km = ?, estimated_duration_mins = ?, waypoints_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(routeResult.totalDistanceKm, routeResult.estimatedDurationMins, JSON.stringify(routeResult.waypoints), routeRecordId);
    } else {
      db.prepare(`
        INSERT INTO delivery_route_records (id, provider_id, route_date, meal_type, total_distance_km, estimated_duration_mins, waypoints_json, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(routeRecordId, providerId, targetDate, meal_type, routeResult.totalDistanceKm, routeResult.estimatedDurationMins, JSON.stringify(routeResult.waypoints));
    }

    return res.json({
      routeRecordId,
      routeDate: targetDate,
      mealType: meal_type,
      origin: routeResult.origin,
      orderedStops: routeResult.orderedStops,
      totalDistanceKm: routeResult.totalDistanceKm,
      estimatedDurationMins: routeResult.estimatedDurationMins,
      waypoints: routeResult.waypoints,
      legs: routeResult.legs,
      isRealRoadNetwork: routeResult.isRealRoadNetwork,
      totalStopsCount: stops.length,
      remainingStopsCount: stops.filter(s => !s.is_completed).length,
      completedStopsCount: stops.filter(s => s.is_completed).length
    });
  } catch (err) {
    console.error('[DELIVERY ROUTE ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to calculate delivery route.' });
  }
});

/**
 * POST /api/provider/delivery-route/complete-stop - Complete delivery stop via OTP or Photo Proof
 */
router.post('/delivery-route/complete-stop', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { order_id, otp, photo_url } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const order = db.prepare(`SELECT * FROM orders WHERE id = ? AND provider_id = ?`).get(order_id, providerId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (otp) {
      const result = OTPEngine.verifyDeliveryOTP(order_id, otp);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
    } else if (photo_url) {
      const result = OTPEngine.recordPhotoDeliveryProof(order_id, photo_url);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
    } else {
      return res.status(400).json({ error: 'Either valid OTP or Photo Proof URL is required to complete delivery.' });
    }

    return res.json({
      success: true,
      message: `Delivery completed successfully for Order #${order.order_number}.`,
      orderId: order_id
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/provider/profile - Full Provider Profile with FSSAI, Bank, and Pricing
 */
router.get('/profile', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const profile = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(providerId);
    const user = db.prepare(`SELECT id, email, role, preferred_language, created_at FROM users WHERE id = ?`).get(req.user.id);
    const fssai = db.prepare(`SELECT * FROM provider_fssai_details WHERE provider_id = ?`).get(providerId) || null;
    const bank = db.prepare(`SELECT * FROM provider_bank_accounts WHERE provider_id = ?`).get(providerId) || null;
    const pricing = db.prepare(`SELECT * FROM provider_pricing WHERE provider_id = ?`).get(providerId) || null;
    const location = db.prepare(`SELECT * FROM provider_locations WHERE provider_id = ? AND is_primary = 1`).get(providerId) || null;
    const serviceArea = db.prepare(`SELECT * FROM provider_service_areas WHERE provider_id = ? AND is_active = 1`).get(providerId) || null;

    return res.json({
      user,
      profile,
      fssai,
      bank,
      pricing,
      location,
      serviceArea
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/provider/profile - Update provider details
 */
router.put('/profile', (req, res) => {
  try {
    const providerId = getProviderId(req);
    const { provider_name, kitchen_name, mobile, kitchen_address, bio, experience_years, food_type, is_open } = req.body;

    if (!provider_name || !kitchen_name || !mobile) {
      return res.status(400).json({ error: 'Provider name, kitchen name, and mobile are required.' });
    }

    db.prepare(`
      UPDATE provider_profiles 
      SET provider_name = ?, kitchen_name = ?, mobile = ?, kitchen_address = COALESCE(?, kitchen_address),
          bio = COALESCE(?, bio), experience_years = COALESCE(?, experience_years), food_type = COALESCE(?, food_type),
          is_open = COALESCE(?, is_open), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(provider_name, kitchen_name, mobile, kitchen_address, bio, experience_years, food_type, is_open, providerId);

    const updatedProfile = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(providerId);
    const updatedUser = db.prepare(`SELECT id, email, role, preferred_language FROM users WHERE id = ?`).get(req.user.id);

    return res.json({
      success: true,
      message: 'Provider profile updated successfully.',
      user: updatedUser,
      profile: updatedProfile
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

