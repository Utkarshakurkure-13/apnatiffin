const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('=== STARTING TODAY\'S FRESH SPECIALS & DIRECT ORDER TESTS ===');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  try {
    // 1. Customer Login
    const custLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
    });
    const custLoginData = await custLoginRes.json();
    assert(custLoginRes.ok && custLoginData.token, 'Customer login successful');
    const custToken = custLoginData.token;

    // 2. Fetch Today's Specials with Swargate Coordinates (18.5018, 73.8636)
    const swargateRes = await fetch(`${BASE_URL}/api/customer/dashboard/today?lat=18.5018&lon=73.8636`, {
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    const swargateData = await swargateRes.json();
    assert(swargateRes.ok, 'Fetched dashboard today data for Swargate');
    assert(Array.isArray(swargateData.todaysSpecialMenus), 'todaysSpecialMenus is an array');
    console.log(`Found ${swargateData.todaysSpecialMenus.length} fresh specials serving Swargate.`);

    // 3. Check every item in todaysSpecialMenus has serves_location and is within radius
    for (const item of swargateData.todaysSpecialMenus) {
      assert(item.serves_location === true, `Item "${item.name}" from ${item.kitchen_name} serves Swargate`);
      assert(item.distance_km <= item.service_radius_km, `Item distance (${item.distance_km} km) <= provider radius (${item.service_radius_km} km)`);
    }

    // 4. Fetch with Far-away Coordinates (e.g. Lonavala: 18.7557, 73.4091)
    const farRes = await fetch(`${BASE_URL}/api/customer/dashboard/today?lat=18.7557&lon=73.4091`, {
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    const farData = await farRes.json();
    assert(farRes.ok, 'Fetched dashboard today data for far-away location');
    assert(farData.todaysSpecialMenus.length === 0, 'No fresh specials shown for out-of-coverage area (Lonavala)');

    // 5. Test Direct Order for a Fresh Special Item
    if (swargateData.todaysSpecialMenus.length > 0) {
      const specialItem = swargateData.todaysSpecialMenus[0];
      console.log(`\nTesting Direct Order for: "${specialItem.name}" (₹${specialItem.price}) from provider ${specialItem.provider_id}`);

      const orderRes = await fetch(`${BASE_URL}/api/customer/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${custToken}`
        },
        body: JSON.stringify({
          provider_id: specialItem.provider_id,
          meal_type: specialItem.meal_type || 'LUNCH',
          plan_type: 'SINGLE',
          menu_item_id: specialItem.id,
          quantity: 2,
          payment_method: 'UPI',
          special_instructions: 'Direct fresh special order test',
          delivery_lat: 18.5018,
          delivery_lon: 73.8636,
          delivery_address: 'Swargate, Pune'
        })
      });

      const orderData = await orderRes.json();
      assert(orderRes.ok, `Direct order placement successful: #${orderData.order?.orderNumber}`);
      assert(orderData.order?.deliveryOtp, `Delivery OTP generated: ${orderData.order?.deliveryOtp}`);
      assert(orderData.order?.finalPayable === (parseFloat(specialItem.price) * 2), `Calculated amount matches 2 × ₹${specialItem.price} = ₹${orderData.order?.finalPayable}`);

      // 6. Verify Active Order in Dashboard Tracker
      const activeRes = await fetch(`${BASE_URL}/api/customer/dashboard/today?lat=18.5018&lon=73.8636`, {
        headers: { 'Authorization': `Bearer ${custToken}` }
      });
      const activeData = await activeRes.json();
      const placedOrder = activeData.activeOrders.find(o => o.id === orderData.order?.id);
      assert(placedOrder !== undefined, 'Placed direct special order immediately visible in active orders tracker');
      if (placedOrder) {
        assert(placedOrder.today_menu_items && placedOrder.today_menu_items.some(i => i.name === specialItem.name), `Active order shows today's fresh special item "${specialItem.name}"`);
      }
    }

    console.log(`\n=== TEST SUMMARY: ${passed}/${total} TESTS PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
