const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('🧪 [TEST SUITE] Starting Order Auto-Acceptance & Out for Delivery Flow Tests...\n');

  // 1. Customer Login (Rohit)
  const custLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const custLogin = await custLoginRes.json();
  assert(custLogin.token, 'Customer login failed');
  const custToken = custLogin.token;
  console.log('✅ 1. Customer authenticated successfully.');

  // 2. Fetch Providers to pick a provider ID
  const provsRes = await fetch(`${BASE_URL}/customer/providers-by-location?lat=18.5314&lon=73.8446`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const provsData = await provsRes.json();
  const provider = provsData.servingYourLocation[0];
  assert(provider, 'No serving provider found');
  console.log(`✅ 2. Found serving provider: ${provider.kitchen_name} (ID: ${provider.id})`);

  // 3. Customer places a new regular single lunch order
  const orderRes = await fetch(`${BASE_URL}/customer/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${custToken}`
    },
    body: JSON.stringify({
      provider_id: provider.id,
      meal_type: 'LUNCH',
      plan_type: 'SINGLE',
      extra_roti_count: 1,
      special_instructions: 'Less oil please',
      payment_method: 'UPI',
      delivery_lat: 18.5314,
      delivery_lon: 73.8446,
      delivery_address: 'Flat 402, Shivajinagar, Pune'
    })
  });
  const orderData = await orderRes.json();
  assert(orderData.success, 'Order creation failed');
  const createdOrder = orderData.order;
  assert(createdOrder.orderNumber, 'Order number missing');
  console.log(`✅ 3. Customer placed order #${createdOrder.orderNumber} successfully. Delivery OTP: ${createdOrder.deliveryOtp}`);

  // 4. Provider Login
  const provLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'radha@annapurna.com', password: 'Provider@123' })
  });
  const provLogin = await provLoginRes.json();
  assert(provLogin.token, 'Provider login failed');
  const provToken = provLogin.token;
  console.log('✅ 4. Provider authenticated successfully.');

  // 5. Verify Provider receives the order and it is AUTOMATICALLY ACCEPTED (status = ACCEPTED)
  const provOrdersRes = await fetch(`${BASE_URL}/provider/orders`, {
    headers: { 'Authorization': `Bearer ${provToken}` }
  });
  const provOrdersData = await provOrdersRes.json();
  const targetOrder = provOrdersData.orders.find(o => o.id === createdOrder.id);
  assert(targetOrder, 'Order not found in provider orders');
  assert.strictEqual(targetOrder.order_status, 'ACCEPTED', `Expected auto-accepted status ACCEPTED, got ${targetOrder.order_status}`);
  console.log(`✅ 5. Order #${targetOrder.order_number} is AUTOMATICALLY ACCEPTED (status: ${targetOrder.order_status}). No manual accept required!`);

  // 6. Check Customer Dashboard Active Orders
  const custDashRes = await fetch(`${BASE_URL}/customer/dashboard/today?lat=18.5314&lon=73.8446`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const custDashData = await custDashRes.json();
  const activeOrderInCustDash = custDashData.activeOrders.find(o => o.id === createdOrder.id);
  assert(activeOrderInCustDash, 'Active order not found on customer dashboard');
  console.log(`✅ 6. Active order visible on Customer Dashboard with OTP ${activeOrderInCustDash.delivery_otp} and kitchen ${activeOrderInCustDash.kitchen_name}.`);

  // 7. Provider clicks "Out for Delivery" (status -> READY)
  const outForDeliveryRes = await fetch(`${BASE_URL}/provider/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provToken}`
    },
    body: JSON.stringify({ status: 'READY' })
  });
  const outData = await outForDeliveryRes.json();
  assert(outData.success, 'Out for delivery status update failed');
  assert.strictEqual(outData.orderStatus, 'READY');
  console.log('✅ 7. Provider clicked "Out for Delivery". Order status updated to READY.');

  // 8. Verify Customer Dashboard now reflects "Out for Delivery"
  const reCustDashRes = await fetch(`${BASE_URL}/customer/dashboard/today?lat=18.5314&lon=73.8446`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const reCustDashData = await reCustDashRes.json();
  const reActiveOrder = reCustDashData.activeOrders.find(o => o.id === createdOrder.id);
  assert.strictEqual(reActiveOrder.order_status, 'READY', 'Customer dashboard should show READY (Out for Delivery)');
  console.log('✅ 8. Customer Dashboard immediately reflects "Out for Delivery" status.');

  // 9. Provider verifies OTP and marks delivered
  const verifyOtpRes = await fetch(`${BASE_URL}/provider/orders/${createdOrder.id}/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provToken}`
    },
    body: JSON.stringify({ otp: createdOrder.deliveryOtp })
  });
  const verifyData = await verifyOtpRes.json();
  assert(verifyData.success, 'OTP verification failed');
  console.log('✅ 9. Provider verified OTP. Order successfully delivered.');

  console.log('\n🎉 ALL 9 AUTOMATIC ACCEPTANCE & OUT-FOR-DELIVERY TESTS PASSED!\n');
}

runTest().catch(err => {
  console.error('\n❌ TEST ERROR:', err);
  process.exit(1);
});
