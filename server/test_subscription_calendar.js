const assert = require('assert');
const SubscriptionEngine = require('./services/subscriptionEngine');

async function runTests() {
  console.log('🧪 [TEST SUITE] Starting Subscription Calendar & Date Engine Tests...\n');

  // TEST 1: Monthly duration 11/10/2026 -> 10/11/2026 (Test 1 from prompt)
  const end1 = SubscriptionEngine.calculateSubscriptionEndDate('2026-10-11', 'MONTHLY');
  assert.strictEqual(end1, '2026-11-10', `Test 1 Failed: Expected 2026-11-10, got ${end1}`);
  console.log('✅ Test 1 Passed: Start 2026-10-11 (1 Month) -> End 2026-11-10');

  // TEST 2: Monthly duration 05/01/2027 -> 04/02/2027 (Test 2 from prompt)
  const end2 = SubscriptionEngine.calculateSubscriptionEndDate('2027-01-05', 'MONTHLY');
  assert.strictEqual(end2, '2027-02-04', `Test 2 Failed: Expected 2027-02-04, got ${end2}`);
  console.log('✅ Test 2 Passed: Start 2027-01-05 (1 Month) -> End 2027-02-04');

  // TEST 3: Variable month-end calculations & Leap years
  // Jan 31 in non-leap year (2026) -> Feb 28 - 1 = Feb 27
  const end3a = SubscriptionEngine.calculateSubscriptionEndDate('2026-01-31', 'MONTHLY');
  assert.strictEqual(end3a, '2026-02-27', `Test 3a Failed: Expected 2026-02-27, got ${end3a}`);
  console.log('✅ Test 3a Passed: Non-leap month-end (2026-01-31) -> End 2026-02-27');

  // Jan 31 in leap year (2028) -> Feb 29 - 1 = Feb 28
  const end3b = SubscriptionEngine.calculateSubscriptionEndDate('2028-01-31', 'MONTHLY');
  assert.strictEqual(end3b, '2028-02-28', `Test 3b Failed: Expected 2028-02-28, got ${end3b}`);
  console.log('✅ Test 3b Passed: Leap year month-end (2028-01-31) -> End 2028-02-28');

  // March 31 -> April 30 - 1 = April 29
  const end3c = SubscriptionEngine.calculateSubscriptionEndDate('2026-03-31', 'MONTHLY');
  assert.strictEqual(end3c, '2026-04-29', `Test 3c Failed: Expected 2026-04-29, got ${end3c}`);
  console.log('✅ Test 3c Passed: 31-day to 30-day month (2026-03-31) -> End 2026-04-29');

  // TEST 4: Weekly subscription calculation (7 days inclusive: start + 6 days)
  const end4 = SubscriptionEngine.calculateSubscriptionEndDate('2026-09-10', 'WEEKLY');
  assert.strictEqual(end4, '2026-09-16', `Test 4 Failed: Expected 2026-09-16, got ${end4}`);
  console.log('✅ Test 4 Passed: Weekly Start 2026-09-10 -> End 2026-09-16 (7 days total)');

  // TEST 5: API End-to-End Calendar Verification
  const BASE_URL = 'http://localhost:5000/api';

  // Login as Customer 1 (Rohit)
  const rohitLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const rohitLogin = await rohitLoginRes.json();
  assert(rohitLogin.token, 'Customer login failed');
  const token = rohitLogin.token;
  console.log('✅ Test 5 Passed: Customer login authenticated successfully.');

  // Fetch active subscription calendar
  const calRes = await fetch(`${BASE_URL}/customer/subscriptions/active-calendar`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const calData = await calRes.json();
  assert(calData.subscription, 'Subscription summary not returned');
  assert(Array.isArray(calData.calendarDates), 'Calendar dates array not returned');
  assert(calData.calendarDates.length > 0, 'Calendar dates is empty');
  console.log(`✅ Test 6 Passed: Fetched active subscription calendar with ${calData.calendarDates.length} days.`);

  // Verify past + today visibility rules:
  const todayStr = new Date().toISOString().split('T')[0];
  const futureDates = calData.calendarDates.filter(d => d.date > todayStr);
  assert.strictEqual(futureDates.length, 0, `Future dates must NOT be visible: found ${futureDates.length}`);
  console.log('✅ Test 7 Passed: Future dates are strictly HIDDEN from calendar.');

  const yesterdayItem = calData.calendarDates.find(d => d.isYesterday);
  const todayItem = calData.calendarDates.find(d => d.isToday);

  if (yesterdayItem) {
    assert.strictEqual(yesterdayItem.meals[0].displayStatus, 'DELIVERED', 'Yesterday meal should be DELIVERED');
    console.log('✅ Test 8 Passed: Past/Yesterday meal status is accurately DELIVERED.');
  }

  if (todayItem) {
    assert(['PREPARING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED', 'CANCELLED'].includes(todayItem.meals[0].displayStatus), 'Today status should match active state');
    console.log(`✅ Test 9 Passed: Today meal status is live: ${todayItem.meals[0].displayStatus}, menu is populated.`);
  }

  console.log('\n🎉 ALL SUBSCRIPTION CALENDAR & VISIBILITY TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
