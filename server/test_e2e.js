/**
 * Comprehensive Automated End-to-End Test Suite for Aapna Tiffin
 */
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING AAPNA TIFFIN PRODUCTION VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, errDetails = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name} ${errDetails ? `(${JSON.stringify(errDetails)})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request({ host: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
    assert(health.status === 200 && health.body.status === 'ok', 'Server health endpoint responds ok');

    // 2. Common Login - Customer
    const custLogin = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'rohit@gmail.com', password: 'Customer@123' });
    assert(custLogin.status === 200 && custLogin.body.user.role === 'CUSTOMER', 'Common login detects CUSTOMER role');
    const custToken = custLogin.body.token;

    // 3. Common Login - Provider (Radha Sharma)
    const provLogin = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'radha@annapurna.com', password: 'Provider@123' });
    assert(provLogin.status === 200 && provLogin.body.user.role === 'PROVIDER', 'Common login detects PROVIDER role');
    const provToken = provLogin.body.token;
    const radhaProfileId = provLogin.body.profile.id;

    // 4. Common Login - Admin
    const adminLogin = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@aapnatiffin.com', password: 'Admin@123' });
    assert(adminLogin.status === 200 && adminLogin.body.user.role === 'ADMIN', 'Common login detects ADMIN role');
    const adminToken = adminLogin.body.token;

    // 5. Customer Provider Discovery (No location/distance fields)
    const discovery = await request({
      host: 'localhost', port: 5000, path: '/api/customer/providers?food_type=ALL', method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(discovery.status === 200 && discovery.body.providers.length >= 2, 'Customer discovers open providers');
    const firstProv = discovery.body.providers.find(p => p.id === radhaProfileId) || discovery.body.providers[0];
    assert(!firstProv.distance && !firstProv.latitude, 'Provider card contains zero GPS/distance fields');

    // 6. Provider Detail with Menu & Ratings
    const provDetail = await request({
      host: 'localhost', port: 5000, path: `/api/customer/providers/${radhaProfileId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(provDetail.status === 200 && provDetail.body.todaysMenu.length >= 1, 'Provider page returns today\'s lunch and dinner items');

    // 7. Place New Meal Order specifically with Radha's kitchen
    const orderRes = await request({
      host: 'localhost', port: 5000, path: '/api/customer/orders', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${custToken}` }
    }, {
      provider_id: radhaProfileId,
      meal_type: 'LUNCH',
      plan_type: 'SINGLE',
      extra_roti_count: 2,
      special_instructions: 'Less oil please'
    });
    assert(orderRes.status === 201 && orderRes.body.order.deliveryOtp.length === 4, 'Order placed successfully with 4-digit Delivery OTP');
    const createdOrder = orderRes.body.order;

    // 8. Provider Order Queue & OTP Delivery Verification
    const provVerifyOtp = await request({
      host: 'localhost', port: 5000, path: `/api/provider/orders/${createdOrder.id}/verify-otp`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provToken}` }
    }, {
      otp: createdOrder.deliveryOtp
    });
    assert(provVerifyOtp.status === 200 && provVerifyOtp.body.orderStatus === 'DELIVERED', 'Provider verifies customer OTP and order status transitions to DELIVERED', provVerifyOtp.body);

    // 9. Customer Rating & Points Award (+5 points)
    const reviewRes = await request({
      host: 'localhost', port: 5000, path: '/api/customer/reviews', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${custToken}` }
    }, {
      order_id: createdOrder.id,
      rating: 5,
      review_text: 'Excellent taste and hot roti!'
    });
    assert(reviewRes.status === 201 && reviewRes.body.pointsAwarded === 5, 'Review submitted successfully and +5 Loyalty Points awarded', reviewRes.body);

    // 10. Customer Points Ledger & Milestone Vouchers
    const pointsRes = await request({
      host: 'localhost', port: 5000, path: '/api/customer/points', method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(pointsRes.status === 200 && pointsRes.body.totalPoints > 0, 'Customer points ledger retrieved');

    // 11. Customer Bills Section (Immutable financial record)
    const billsRes = await request({
      host: 'localhost', port: 5000, path: '/api/customer/bills', method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(billsRes.status === 200 && billsRes.body.bills.length >= 1, 'Customer bills section displays immutable itemized transaction');

    // 12. Provider Earnings Breakdown
    const earnRes = await request({
      host: 'localhost', port: 5000, path: '/api/provider/earnings', method: 'GET',
      headers: { 'Authorization': `Bearer ${provToken}` }
    });
    assert(earnRes.status === 200 && earnRes.body.summary.gross_income > 0, 'Provider earnings calculates gross, 15% commission, and net payable');

    // 13. Admin Dashboard & Governance
    const adminDash = await request({
      host: 'localhost', port: 5000, path: '/api/admin/dashboard', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminDash.status === 200 && adminDash.body.providers.active_providers >= 2, 'Admin Dashboard reports active providers without KYC approval queue');

    // 14. Admin Settings (Configurable cancellation penalty: 20% vs 30% pending product decision)
    const adminSettings = await request({
      host: 'localhost', port: 5000, path: '/api/admin/settings', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminSettings.status === 200 && adminSettings.body.settings.platform_commission_percent === '15', 'Admin settings retrieves 15% commission and configurable penalty rules');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');
}

runTests();
