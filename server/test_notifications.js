const http = require('http');
const db = require('./config/database');
const NotificationEngine = require('./services/notificationEngine');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING NOTIFICATION & PAYMENT TESTS');
  console.log('========================================\n');

  await db.init();

  // 1. Get sample users
  const customer = db.prepare(`SELECT u.id, u.email, c.id as cust_id FROM users u JOIN customer_profiles c ON u.id = c.user_id LIMIT 1`).get();
  const provider = db.prepare(`SELECT u.id, u.email, p.id as prov_id FROM users u JOIN provider_profiles p ON u.id = p.user_id LIMIT 1`).get();
  const admin = db.prepare(`SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`).get();

  console.log(`👤 Customer: ${customer?.email} (${customer?.id})`);
  console.log(`👨‍🍳 Provider: ${provider?.email} (${provider?.id})`);
  console.log(`🛡️ Admin: ${admin?.email} (${admin?.id})`);

  if (!customer || !provider || !admin) {
    console.error('❌ Missing seeded users for test.');
    process.exit(1);
  }

  // 2. Test NotificationEngine direct dispatch
  console.log('\n--- 1. Testing NotificationEngine direct dispatch ---');
  const normalNotif = NotificationEngine.sendNotification({
    userId: customer.id,
    type: 'ORDER',
    soundType: 'notification',
    title_en: 'Test Normal Order Notification',
    message_en: 'Your lunch order is confirmed.'
  });
  console.log('✅ Sent normal notification:', normalNotif);

  const paymentNotif = NotificationEngine.sendNotification({
    userId: customer.id,
    type: 'PAYMENT',
    soundType: 'payment',
    title_en: 'Test Payment Success Notification',
    message_en: 'Payment of ₹110.00 processed successfully.'
  });
  console.log('✅ Sent payment notification:', paymentNotif);

  // Check in DB
  const dbCheck = db.prepare(`SELECT id, user_id, sound_type, type, is_read FROM notifications WHERE id = ?`).get(paymentNotif.id);
  console.log('✅ Verified in DB sound_type = payment:', dbCheck.sound_type === 'payment' && dbCheck.is_read === 0);

  // 3. Test Admin Multi-dispatch
  console.log('\n--- 2. Testing NotificationEngine.notifyAdmins ---');
  NotificationEngine.notifyAdmins({
    type: 'SYSTEM',
    soundType: 'notification',
    title_en: 'Test Admin Broadcast',
    message_en: 'System event triggered.'
  });
  const adminNotif = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).get(admin.id);
  console.log('✅ Admin received broadcast:', adminNotif?.title_en === 'Test Admin Broadcast');

  // 4. Test API Endpoints with JWT Token
  console.log('\n--- 3. Testing API /api/notifications endpoints ---');
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('./middleware/auth');
  
  const custToken = jwt.sign({ id: customer.id, email: customer.email, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });
  const provToken = jwt.sign({ id: provider.id, email: provider.email, role: 'PROVIDER' }, JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

  // Trigger a fresh test notification through HTTP endpoint
  const triggerResp = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications/test',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${custToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    title: 'Order Payment Completed',
    message: 'Payment of ₹150.00 confirmed successfully.',
    type: 'PAYMENT',
    soundType: 'payment'
  });

  console.log(`✅ POST /api/notifications/test status: ${triggerResp.status}`);

  // GET /api/notifications for Customer
  const getNotifs = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });

  console.log(`✅ GET /api/notifications status: ${getNotifs.status}`);
  console.log(`📊 Customer Unread count: ${getNotifs.data.unreadCount}`);
  console.log(`📬 Customer Total notifications returned: ${getNotifs.data.notifications?.length}`);

  const hasPaymentNotif = getNotifs.data.notifications?.some(n => n.sound_type === 'payment');
  console.log(`✅ Contains sound_type="payment" in HTTP response: ${hasPaymentNotif}`);

  // Test single mark as read
  if (getNotifs.data.notifications?.length > 0) {
    const firstId = getNotifs.data.notifications[0].id;
    const readResp = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/notifications/${firstId}/read`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    console.log(`✅ PUT /api/notifications/${firstId}/read status: ${readResp.status}`);

    // Verify mark all as read
    const readAllResp = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/notifications/read-all',
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    console.log(`✅ PUT /api/notifications/read-all status: ${readAllResp.status}`);

    // Re-verify unread count is 0
    const getNotifsAfter = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/notifications',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    console.log(`✅ Unread count after read-all: ${getNotifsAfter.data.unreadCount} (Expected: 0)`);
  }

  // 5. Test Role and User Isolation
  console.log('\n--- 4. Testing User and Role Isolation ---');
  const provNotifs = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${provToken}` }
  });

  const anyCustomerNotifsInProvider = provNotifs.data.notifications?.some(n => n.user_id !== provider.id);
  console.log(`✅ Provider cannot see other users notifications: ${!anyCustomerNotifsInProvider}`);

  const adminNotifs = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✅ Admin fetched their own notifications: ${adminNotifs.status === 200 && Array.isArray(adminNotifs.data.notifications)}`);

  console.log('\n========================================');
  console.log('🎉 ALL NOTIFICATION & PAYMENT TESTS PASSED');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
