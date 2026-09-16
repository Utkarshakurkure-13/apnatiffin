const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const CancellationEngine = require('../services/cancellationEngine');

// Admin-only middleware
router.use(authenticateJWT, requireRole('ADMIN'));

/**
 * GET /api/admin/dashboard - High level marketplace metrics
 */
router.get('/dashboard', (req, res) => {
  // Customer metrics
  const customerStats = db.prepare(`
    SELECT
      COUNT(u.id) as total_customers,
      COUNT(CASE WHEN u.is_blocked = 1 THEN 1 END) as blocked_customers
    FROM users u
    WHERE u.role = 'CUSTOMER'
  `).get();

  // Provider metrics (No KYC queue!)
  const providerStats = db.prepare(`
    SELECT
      COUNT(p.id) as total_providers,
      COUNT(CASE WHEN p.is_open = 1 AND u.is_blocked = 0 THEN 1 END) as active_providers,
      COUNT(CASE WHEN u.is_blocked = 1 THEN 1 END) as blocked_providers
    FROM provider_profiles p
    JOIN users u ON p.user_id = u.id
  `).get();

  // Today's orders
  const orderStats = db.prepare(`
    SELECT
      COUNT(id) as total_orders,
      COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN order_status = 'CANCELLED' THEN 1 END) as cancelled_orders,
      COUNT(CASE WHEN order_status = 'FAILED' THEN 1 END) as failed_orders,
      COUNT(CASE WHEN order_status = 'NEW' OR order_status = 'ACCEPTED' OR order_status = 'PREPARING' OR order_status = 'READY' THEN 1 END) as active_orders
    FROM orders
  `).get();

  // Financial statistics from immutable bills
  const financeStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN bill_type = 'CUSTOMER' THEN gross_amount ELSE 0 END), 0) as total_collected,
      COALESCE(SUM(platform_commission), 0) as total_commission_earned,
      COALESCE(SUM(provider_penalty), 0) as total_penalties_collected,
      COALESCE(SUM(refund_amount), 0) as total_refunds_processed,
      COALESCE(SUM(CASE WHEN bill_type = 'PROVIDER' THEN final_payable ELSE 0 END), 0) as provider_payable_balance
    FROM bills
  `).get();

  // Complaints
  const complaintStats = db.prepare(`
    SELECT
      COUNT(id) as total_complaints,
      COUNT(CASE WHEN status = 'OPEN' OR status = 'UNDER_REVIEW' THEN 1 END) as pending_complaints
    FROM complaints
  `).get();

  return res.json({
    customers: customerStats,
    providers: providerStats,
    orders: orderStats,
    finance: financeStats,
    complaints: complaintStats
  });
});

/**
 * GET /api/admin/customers
 */
router.get('/customers', (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT c.*, u.email, u.is_blocked, u.preferred_language, u.created_at as registered_at,
           (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_orders,
           (SELECT COALESCE(SUM(final_amount), 0) FROM orders WHERE customer_id = c.id) as total_spent,
           (SELECT COALESCE(SUM(points_change), 0) FROM customer_points_ledger WHERE customer_id = c.id) as reward_points
    FROM customer_profiles c
    JOIN users u ON c.user_id = u.id
  `;
  const params = [];

  if (search) {
    query += ` WHERE c.full_name LIKE ? OR u.email LIKE ? OR c.mobile LIKE ?`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` ORDER BY u.created_at DESC`;
  const customers = db.prepare(query).all(...params);

  return res.json({ customers });
});

/**
 * PUT /api/admin/customers/:id/toggle-block
 */
router.put('/customers/:id/toggle-block', (req, res) => {
  const customer = db.prepare(`SELECT * FROM customer_profiles WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const user = db.prepare(`SELECT is_blocked FROM users WHERE id = ?`).get(customer.user_id);
  const newBlockedState = user.is_blocked === 1 ? 0 : 1;

  db.prepare(`UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newBlockedState, customer.user_id);

  return res.json({
    success: true,
    is_blocked: newBlockedState,
    message: newBlockedState === 1 ? 'Customer account has been blocked.' : 'Customer account has been unblocked.'
  });
});

/**
 * GET /api/admin/providers (NO manual KYC approval state)
 */
router.get('/providers', (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT p.*, u.email, u.is_blocked, u.preferred_language, u.created_at as registered_at,
           b.account_holder, b.account_number_masked, b.bank_name, b.ifsc_code,
           k.aadhaar_masked, k.pan_masked, k.kitchen_proof_url, k.completed_at as kyc_completed_at,
           f.has_fssai, f.fssai_number,
           (SELECT COUNT(*) FROM orders WHERE provider_id = p.id) as total_orders,
           (SELECT COALESCE(SUM(gross_amount), 0) FROM bills WHERE provider_id = p.id AND bill_type = 'PROVIDER') as gross_sales,
           (SELECT COALESCE(SUM(penalty_points), 0) FROM penalty_ledger WHERE provider_id = p.id) as penalty_points
    FROM provider_profiles p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN provider_bank_accounts b ON p.id = b.provider_id
    LEFT JOIN provider_kyc_records k ON p.id = k.provider_id
    LEFT JOIN provider_fssai_details f ON p.id = f.provider_id
  `;
  const params = [];

  if (search) {
    query += ` WHERE p.kitchen_name LIKE ? OR p.provider_name LIKE ? OR u.email LIKE ?`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` ORDER BY u.created_at DESC`;
  const providers = db.prepare(query).all(...params);

  return res.json({ providers });
});

/**
 * PUT /api/admin/providers/:id/toggle-block
 */
router.put('/providers/:id/toggle-block', (req, res) => {
  const provider = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const user = db.prepare(`SELECT is_blocked FROM users WHERE id = ?`).get(provider.user_id);
  const newBlockedState = user.is_blocked === 1 ? 0 : 1;

  db.prepare(`UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newBlockedState, provider.user_id);

  return res.json({
    success: true,
    is_blocked: newBlockedState,
    message: newBlockedState === 1 ? 'Provider kitchen blocked.' : 'Provider kitchen unblocked.'
  });
});

/**
 * GET /api/admin/orders
 */
router.get('/orders', (req, res) => {
  const { status, search } = req.query;
  let query = `
    SELECT o.*, c.full_name as customer_name, c.mobile as customer_mobile,
           p.kitchen_name, p.provider_name, p.mobile as provider_mobile
    FROM orders o
    JOIN customer_profiles c ON o.customer_id = c.id
    JOIN provider_profiles p ON o.provider_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    query += ` AND o.order_status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (o.order_number LIKE ? OR c.full_name LIKE ? OR p.kitchen_name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` ORDER BY o.created_at DESC LIMIT 100`;
  const orders = db.prepare(query).all(...params);

  return res.json({ orders });
});

/**
 * POST /api/admin/orders/:id/fail - Mark order as delivery failed with 20% penalty + 10 penalty points
 */
router.post('/orders/:id/fail', (req, res) => {
  try {
    const { reason = 'Provider delivery failure verified by admin' } = req.body;
    const result = CancellationEngine.processDeliveryFailure(req.params.id, req.user.id, reason);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/payments
 */
router.get('/payments', (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, o.order_number, c.full_name as customer_name, prov.kitchen_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN customer_profiles c ON p.customer_id = c.id
    JOIN provider_profiles prov ON p.provider_id = prov.id
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all();

  const settlements = db.prepare(`
    SELECT p.id as provider_id, p.kitchen_name, p.provider_name,
           COALESCE(SUM(b.gross_amount), 0) as gross_sales,
           COALESCE(SUM(b.platform_commission), 0) as commission,
           COALESCE(SUM(b.provider_penalty), 0) as penalties,
           COALESCE(SUM(b.final_payable), 0) as net_payable
    FROM provider_profiles p
    LEFT JOIN bills b ON p.id = b.provider_id AND b.bill_type = 'PROVIDER'
    GROUP BY p.id
    ORDER BY gross_sales DESC
  `).all();

  return res.json({ payments, settlements });
});

/**
 * POST /api/admin/payouts/process - Process provider payout
 */
router.post('/payouts/process', (req, res) => {
  const { provider_id, amount, gross_amount, commission, penalties } = req.body;
  if (!provider_id || !amount) {
    return res.status(400).json({ error: 'Provider ID and amount are required.' });
  }

  const payoutNumber = `PAYOUT-${Date.now().toString().slice(-6)}`;
  const txnRef = `NEFT-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO provider_payouts (
      id, payout_number, provider_id, gross_earnings, commission_deducted,
      penalties_deducted, net_payout, status, transaction_ref, period_start, period_end
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSED', ?, ?, ?)
  `).run(
    uuidv4(), payoutNumber, provider_id, gross_amount || amount, commission || 0,
    penalties || 0, amount, txnRef, today, today
  );

  return res.json({ success: true, payoutNumber, transactionRef: txnRef, message: 'Provider payout processed successfully.' });
});

/**
 * GET /api/admin/settings
 */
router.get('/settings', (req, res) => {
  const settings = db.prepare(`SELECT * FROM admin_settings`).all();
  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });
  return res.json({ settings: settingsMap, rawSettings: settings });
});

/**
 * PUT /api/admin/settings
 */
router.put('/settings', (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings object provided.' });
  }

  const updateStmt = db.prepare(`
    INSERT INTO admin_settings (key, value, description, updated_at)
    VALUES (?, ?, '', CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const txn = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      updateStmt.run(key, String(value));
    }
  });

  txn();

  return res.json({ success: true, message: 'Platform settings updated successfully.' });
});

/**
 * Complaints
 */
router.get('/complaints', (req, res) => {
  const complaints = db.prepare(`
    SELECT c.*, o.order_number, u.email as reporter_email
    FROM complaints c
    LEFT JOIN orders o ON c.order_id = o.id
    LEFT JOIN users u ON c.reporter_id = u.id
    ORDER BY c.created_at DESC
  `).all();
  return res.json({ complaints });
});

router.put('/complaints/:id/status', (req, res) => {
  const { status, resolution_notes } = req.body;
  db.prepare(`
    UPDATE complaints
    SET status = ?, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, resolution_notes || null, req.params.id);

  return res.json({ success: true, message: 'Complaint status updated.' });
});

/**
 * Reports
 */
router.get('/reports', (req, res) => {
  const ordersByStatus = db.prepare(`
    SELECT order_status, COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total_value
    FROM orders
    GROUP BY order_status
  `).all();

  const revenueByDay = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as total_orders, COALESCE(SUM(final_amount), 0) as daily_revenue
    FROM orders
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 14
  `).all();

  const topKitchens = db.prepare(`
    SELECT p.kitchen_name, p.food_type, p.rating_avg, COUNT(o.id) as order_count, COALESCE(SUM(o.final_amount), 0) as total_revenue
    FROM provider_profiles p
    LEFT JOIN orders o ON p.id = o.provider_id
    GROUP BY p.id
    ORDER BY total_revenue DESC
    LIMIT 5
  `).all();

  return res.json({ ordersByStatus, revenueByDay, topKitchens });
});

/**
 * Audit Logs
 */
router.get('/audit-logs', (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.email as actor_email, u.role as actor_role
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();
  return res.json({ logs });
});

/**
 * GET /api/admin/profile - Admin profile and platform system health info
 */
router.get('/profile', (req, res) => {
  try {
    const user = db.prepare(`SELECT id, email, role, preferred_language, created_at FROM users WHERE id = ?`).get(req.user.id);
    const systemInfo = {
      totalUsers: db.prepare(`SELECT COUNT(*) as count FROM users`).get()?.count || 0,
      totalCustomers: db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'CUSTOMER'`).get()?.count || 0,
      totalProviders: db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'PROVIDER'`).get()?.count || 0,
      totalOrders: db.prepare(`SELECT COUNT(*) as count FROM orders`).get()?.count || 0,
      totalSubscriptions: db.prepare(`SELECT COUNT(*) as count FROM subscriptions`).get()?.count || 0,
      systemTime: new Date().toISOString()
    };
    return res.json({ user, systemInfo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/profile - Update admin settings
 */
router.put('/profile', (req, res) => {
  try {
    const { preferred_language } = req.body;
    if (preferred_language && ['en', 'mr', 'hi'].includes(preferred_language)) {
      db.prepare(`UPDATE users SET preferred_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(preferred_language, req.user.id);
    }
    const updatedUser = db.prepare(`SELECT id, email, role, preferred_language FROM users WHERE id = ?`).get(req.user.id);
    return res.json({ success: true, message: 'Admin profile updated successfully.', user: updatedUser });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
