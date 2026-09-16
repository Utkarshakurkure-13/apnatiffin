const assert = require('assert');
const http = require('http');

async function testFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  console.log('=== VERIFYING TODAY\'S ACTIVE ORDER SECTION ENHANCEMENTS ===');

  // 1. Customer Authentication
  const loginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const authData = JSON.parse(loginRes.data);
  assert(authData.token, 'Customer login failed');
  console.log('1. Customer Login: ✓ PASS');

  // 2. Fetch Today Dashboard Bundle
  const todayRes = await testFetch('http://localhost:5000/api/customer/dashboard/today', {
    headers: { 'Authorization': 'Bearer ' + authData.token }
  });
  assert.strictEqual(todayRes.status, 200, 'Dashboard today fetch failed');
  const todayData = JSON.parse(todayRes.data);
  
  assert(Array.isArray(todayData.activeOrders), 'activeOrders must be an array');
  console.log(`2. Active Orders Count: ${todayData.activeOrders.length}`);

  if (todayData.activeOrders.length > 0) {
    const activeOrder = todayData.activeOrders[0];
    console.log('\n--- Active Order Inspection ---');
    console.log('Order #:', activeOrder.order_number);
    console.log('Kitchen:', activeOrder.kitchen_name);
    console.log('Chef:', activeOrder.provider_name);
    console.log('Status:', activeOrder.order_status);
    console.log('Delivery OTP:', activeOrder.delivery_otp);
    console.log('Expected Delivery Time:', activeOrder.expected_delivery_time);
    
    assert(activeOrder.delivery_otp, 'Delivery OTP missing');
    assert(activeOrder.expected_delivery_time, 'Expected Delivery Time missing');
    assert(Array.isArray(activeOrder.today_menu_items), 'today_menu_items must be an array');
    assert(activeOrder.today_menu_items.length > 0, 'today_menu_items must have food items');

    console.log('\n--- Today\'s Tiffin Menu Items ---');
    activeOrder.today_menu_items.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.category || 'Special'}] ${item.name} ${item.is_speciality ? '★ Special' : ''}`);
      assert(item.name, 'Item name required');
      assert(item.category, 'Item category required');
    });

    console.log('✓ All Today\'s Tiffin items, categories and expected delivery verified!');
  }

  console.log('\n=== TODAY\'S ACTIVE ORDER ENHANCEMENTS VERIFIED SUCCESSFULLY! ===');
})();
