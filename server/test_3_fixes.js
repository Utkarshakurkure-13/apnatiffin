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
  console.log('===============================================================');
  console.log('🧪 TESTING 3 SPECIFIC FIXES (RATINGS, MENU/FREQ, LOGIN/ROUTING)');
  console.log('===============================================================\n');

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
    // -------------------------------------------------------------
    // FIX 1: PROVIDER RATING & REVIEW BALANCE
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Provider Rating & Review Data Consistency ---');
    
    // Login as Customer (Rohit)
    const custLogin = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'rohit@gmail.com', password: 'Customer@123' });
    assert(custLogin.status === 200, 'Customer Rohit logged in');
    const custToken = custLogin.body.token;

    // Fetch Providers
    const provsRes = await request({
      host: 'localhost', port: 5000, path: '/api/customer/providers', method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(provsRes.status === 200, 'Fetched provider list');
    const providers = provsRes.body.providers;
    const radha = providers.find(p => p.provider_name === 'Radha Sharma');
    const sarita = providers.find(p => p.provider_name === 'Sarita Deshmukh');
    const anita = providers.find(p => p.provider_name === 'Anita Patil');

    assert(radha && radha.total_reviews === 1 && radha.rating_avg === 5.0, 
      `Radha (1 review) has rating_avg=5.0 and total_reviews=1 (actual: ${radha?.rating_avg}, ${radha?.total_reviews})`);
    assert(sarita && sarita.total_reviews === 0 && sarita.rating_avg === 0.0, 
      `Sarita (0 reviews) has rating_avg=0.0 and total_reviews=0 (actual: ${sarita?.rating_avg}, ${sarita?.total_reviews})`);
    assert(anita && anita.total_reviews === 0 && anita.rating_avg === 0.0, 
      `Anita (0 reviews) has rating_avg=0.0 and total_reviews=0 (actual: ${anita?.rating_avg}, ${anita?.total_reviews})`);

    // Fetch Provider Detail for Radha & Sarita
    const radhaDetail = await request({
      host: 'localhost', port: 5000, path: `/api/customer/providers/${radha.id}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(radhaDetail.status === 200 && radhaDetail.body.reviews.length === 1, 'Radha detail has 1 review in database');

    const saritaDetail = await request({
      host: 'localhost', port: 5000, path: `/api/customer/providers/${sarita.id}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    assert(saritaDetail.status === 200 && saritaDetail.body.reviews.length === 0 && saritaDetail.body.provider.rating_avg === 0.0, 
      'Sarita detail has 0 reviews and rating_avg=0.0');

    // -------------------------------------------------------------
    // FIX 2: SPECIFIC FOOD ITEMS & PREPARATION FREQUENCY
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Specific Food Items & Preparation Frequency ---');

    // Login as Provider (Radha)
    const radhaLogin = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'radha@annapurna.com', password: 'Provider@123' });
    assert(radhaLogin.status === 200 && radhaLogin.body.user.role === 'PROVIDER', 'Provider Radha logged in');
    const radhaToken = radhaLogin.body.token;

    // Provider Menu
    const menuRes = await request({
      host: 'localhost', port: 5000, path: '/api/provider/menu', method: 'GET',
      headers: { 'Authorization': `Bearer ${radhaToken}` }
    });
    assert(menuRes.status === 200, 'Fetched provider menu');
    const menuItems = menuRes.body.menuItems;
    const dalFryItem = menuItems.find(m => m.name === 'Dal Fry');
    const matarPaneerItem = menuItems.find(m => m.name === 'Matar Paneer');
    assert(!!dalFryItem, 'Dal Fry exists as a specific individual food item in today menu');
    assert(!!matarPaneerItem, 'Matar Paneer exists as a specific individual food item in today menu');

    // Provider Prep Frequency
    const prepFreqRes = await request({
      host: 'localhost', port: 5000, path: '/api/provider/prep-frequency', method: 'GET',
      headers: { 'Authorization': `Bearer ${radhaToken}` }
    });
    assert(prepFreqRes.status === 200, 'Fetched provider prep frequency');
    const prepFreq = prepFreqRes.body.prepFrequency;
    const dalFryFreq = prepFreq.find(p => p.name === 'Dal Fry');
    const matarPaneerFreq = prepFreq.find(p => p.name === 'Matar Paneer');
    assert(dalFryFreq && dalFryFreq.frequency === 'Daily', `Dal Fry has frequency attached: ${dalFryFreq?.frequency}`);
    assert(matarPaneerFreq && (matarPaneerFreq.frequency === '5 times/week' || matarPaneerFreq.frequency === '4 times/week'), 
      `Matar Paneer has frequency attached: ${matarPaneerFreq?.frequency}`);

    // Customer Provider Detail Top Prepared Dishes
    const custProvDetail = await request({
      host: 'localhost', port: 5000, path: `/api/customer/providers/${radha.id}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    const custPrepFreq = custProvDetail.body.prepFrequency;
    const custDalFry = custPrepFreq.find(p => p.name === 'Dal Fry');
    const custMatarPaneer = custPrepFreq.find(p => p.name === 'Matar Paneer');
    assert(!!custDalFry && !!custMatarPaneer, 'Customer Top Prepared Dishes returns matching individual food items (Dal Fry & Matar Paneer)');
    assert(custDalFry?.frequency === 'Daily', `Customer Top Prepared Dish Dal Fry has frequency: ${custDalFry?.frequency}`);

    // -------------------------------------------------------------
    // FIX 3: NEW CUSTOMER & PROVIDER REGISTRATION & LOGIN
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing New Customer & Provider Registration and Login ---');

    const randId = Math.floor(1000 + Math.random() * 9000);
    const newCustEmail = `testcust_${randId}@example.com`;
    const newCustPass = 'TestPass@123';

    // 3A. Register New Customer
    const regCustRes = await request({
      host: 'localhost', port: 5000, path: '/api/auth/register/customer', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      full_name: 'Aditya Kulkarni',
      email: newCustEmail,
      password: newCustPass,
      mobile: '9822998877',
      delivery_address: 'Flat 101, Mayur Towers, Kothrud, Pune',
      preferred_language: 'en'
    });
    assert(regCustRes.status === 201 && regCustRes.body.user.role === 'CUSTOMER', 'New Customer registered successfully');
    assert(regCustRes.body.profile && regCustRes.body.profile.full_name === 'Aditya Kulkarni', 'New Customer profile created correctly');

    // 3B. Immediately Login with New Customer Email + Password
    const loginNewCust = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: newCustEmail, password: newCustPass });
    assert(loginNewCust.status === 200, 'Newly registered Customer logged in successfully with email + password');
    assert(loginNewCust.body.user.role === 'CUSTOMER', 'Identified role as CUSTOMER');
    assert(loginNewCust.body.profile && loginNewCust.body.profile.full_name === 'Aditya Kulkarni', 'Returned correct Customer profile');
    const newCustToken = loginNewCust.body.token;

    // Access customer dashboard endpoint with new customer
    const newCustDash = await request({
      host: 'localhost', port: 5000, path: '/api/customer/dashboard/today', method: 'GET',
      headers: { 'Authorization': `Bearer ${newCustToken}` }
    });
    assert(newCustDash.status === 200, 'New customer can successfully load Customer Dashboard data');

    // 3C. Register New Provider
    const newProvEmail = `testprov_${randId}@example.com`;
    const newProvPass = 'TestProv@123';

    const regProvRes = await request({
      host: 'localhost', port: 5000, path: '/api/auth/register/provider', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      provider_name: 'Meera Joshi',
      email: newProvEmail,
      password: newProvPass,
      mobile: '9765112233',
      kitchen_name: 'Meera Homestyle Kitchen',
      kitchen_address: 'B-12, Green Acres, Aundh, Pune',
      food_type: 'Veg',
      experience_years: 4,
      bio: 'Authentic homestyle cooking with love and fresh spices.',
      account_holder: 'Meera Joshi',
      account_number: '123456789012',
      bank_name: 'State Bank of India',
      ifsc_code: 'SBIN0001234',
      aadhaar_number: '987654321098',
      pan_number: 'ABCDE1234F',
      self_declaration_accepted: true,
      preferred_language: 'en'
    });
    assert(regProvRes.status === 201 && regProvRes.body.user.role === 'PROVIDER', 'New Provider registered successfully');
    assert(regProvRes.body.profile && regProvRes.body.profile.kitchen_name === 'Meera Homestyle Kitchen', 'New Provider profile created correctly');
    assert(regProvRes.body.profile.rating_avg === 0.0 && regProvRes.body.profile.total_reviews === 0, 
      `New Provider has rating_avg=0.0 and total_reviews=0 upon registration (actual: ${regProvRes.body.profile.rating_avg}, ${regProvRes.body.profile.total_reviews})`);

    // 3D. Immediately Login with New Provider Email + Password
    const loginNewProv = await request({
      host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: newProvEmail, password: newProvPass });
    assert(loginNewProv.status === 200, 'Newly registered Provider logged in successfully with email + password');
    assert(loginNewProv.body.user.role === 'PROVIDER', 'Identified role as PROVIDER');
    assert(loginNewProv.body.profile && loginNewProv.body.profile.kitchen_name === 'Meera Homestyle Kitchen', 'Returned correct Provider profile');
    const newProvToken = loginNewProv.body.token;

    // Access provider overview and menu endpoints with new provider
    const newProvOverview = await request({
      host: 'localhost', port: 5000, path: '/api/provider/overview', method: 'GET',
      headers: { 'Authorization': `Bearer ${newProvToken}` }
    });
    assert(newProvOverview.status === 200, 'New provider can successfully load Provider Dashboard data');

    const newProvMenu = await request({
      host: 'localhost', port: 5000, path: '/api/provider/menu', method: 'GET',
      headers: { 'Authorization': `Bearer ${newProvToken}` }
    });
    assert(newProvMenu.status === 200 && newProvMenu.body.menuItems.length > 0, 'New provider menu items loaded properly');

    console.log('\n===============================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal error during test run:', err);
  }
}

runTests();
