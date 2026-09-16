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
  console.log('=== MULTI-PROVIDER SUBSCRIPTION & MENU VISIBILITY VERIFICATION ===');
  
  // 1. Customer login (Rohit)
  const loginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const { token } = JSON.parse(loginRes.data);
  assert(token, 'Customer login failed');
  console.log('1. Customer Login: ✓ PASS');

  // 2. Fetch all subscriptions
  const subsRes = await testFetch('http://localhost:5000/api/customer/subscriptions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const subsData = JSON.parse(subsRes.data);
  const subs = subsData.subscriptions || [];
  console.log('2. Customer Subscriptions Count:', subs.length);
  
  const providersSet = new Set(subs.map(s => s.kitchen_name));
  console.log('   Distinct Providers for this customer:', Array.from(providersSet));
  assert(providersSet.size >= 2, 'Customer should have multiple distinct providers');
  console.log('   ✓ Multiple distinct provider subscriptions verified for single customer!');

  // 3. For each subscription, test calendar and menu visibility rules
  for (const sub of subs) {
    console.log(`\n--- Provider Subscription: ${sub.kitchen_name} (${sub.plan_type} - ${sub.meal_type}) ---`);
    const calRes = await testFetch(`http://localhost:5000/api/customer/subscriptions/${sub.id}/calendar`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const calData = JSON.parse(calRes.data);
    assert(calData.subscription, 'Subscription summary missing');
    assert(Array.isArray(calData.calendarDates), 'Calendar dates missing');
    console.log(`   Subscription ID: ${sub.id}`);
    console.log(`   Calendar Dates Total: ${calData.calendarDates.length}`);
    
    // Check future dates
    const futureDates = calData.calendarDates.filter(d => d.isFuture);
    for (const fd of futureDates) {
      for (const meal of fd.meals) {
        assert(
          !meal.menuSnapshot || meal.menuSnapshot.length === 0,
          `Future date ${fd.date} must NOT expose any menu items to customer!`
        );
      }
    }
    console.log(`   ✓ PASS: All ${futureDates.length} future dates have 0 future menu exposure.`);

    // Check today date
    const todayDate = calData.calendarDates.find(d => d.isToday);
    if (todayDate) {
      console.log(`   ✓ Today date (${todayDate.date}) found, meals:`, todayDate.meals.map(m => `${m.mealType}: ${m.displayStatus} (${m.menuSnapshot?.length || 0} dishes)`));
    }

    // Check past delivered vs cancelled
    const pastDelivered = calData.calendarDates.filter(d => d.isPast && d.meals.some(m => m.displayStatus === 'DELIVERED'));
    console.log(`   ✓ Past delivered dates count: ${pastDelivered.length}`);
  }

  console.log('\n=== ALL MULTI-PROVIDER & MENU VISIBILITY RULES VERIFIED SUCCESSFULLY! ===');
})();
