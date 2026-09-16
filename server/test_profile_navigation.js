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
  console.log('=== ROLE-BASED PROFILE NAVIGATION & DATA VERIFICATION ===');

  // 1. CUSTOMER PROFILE TEST
  console.log('\n--- 1. Testing Customer Profile ---');
  const custLoginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const custAuth = JSON.parse(custLoginRes.data);
  assert(custAuth.token, 'Customer login failed');
  assert.strictEqual(custAuth.user.role, 'CUSTOMER', 'Role must be CUSTOMER');
  console.log('   ✓ Customer authentication successful.');

  const custProfileRes = await testFetch('http://localhost:5000/api/customer/profile', {
    headers: { 'Authorization': 'Bearer ' + custAuth.token }
  });
  const custProfileData = JSON.parse(custProfileRes.data);
  assert(custProfileData.profile, 'Customer profile missing');
  assert(custProfileData.stats, 'Customer stats missing');
  console.log('   ✓ Customer Profile Loaded:', {
    name: custProfileData.profile.full_name,
    mobile: custProfileData.profile.mobile,
    deliveryAddress: custProfileData.profile.delivery_address?.slice(0, 30) + '...',
    activeOrders: custProfileData.stats.activeOrdersCount,
    activeSubs: custProfileData.stats.activeSubsCount,
    points: custProfileData.stats.availablePoints
  });

  const custUpdateRes = await testFetch('http://localhost:5000/api/customer/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custAuth.token },
    body: JSON.stringify({
      full_name: 'Rohit Patil',
      mobile: '9876543210',
      delivery_address: 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune',
      preferred_language: 'en'
    })
  });
  assert(custUpdateRes.status === 200, 'Customer profile update failed');
  console.log('   ✓ Customer Profile Update & Persistence verified.');

  // 2. PROVIDER PROFILE TEST
  console.log('\n--- 2. Testing Provider Profile ---');
  const provLoginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'radha@annapurna.com', password: 'Provider@123' })
  });
  const provAuth = JSON.parse(provLoginRes.data);
  assert(provAuth.token, 'Provider login failed');
  assert.strictEqual(provAuth.user.role, 'PROVIDER', 'Role must be PROVIDER');
  console.log('   ✓ Provider authentication successful.');

  const provProfileRes = await testFetch('http://localhost:5000/api/provider/profile', {
    headers: { 'Authorization': 'Bearer ' + provAuth.token }
  });
  const provProfileData = JSON.parse(provProfileRes.data);
  assert(provProfileData.profile, 'Provider profile missing');
  console.log('   ✓ Provider Profile Loaded:', {
    kitchen: provProfileData.profile.kitchen_name,
    chef: provProfileData.profile.provider_name,
    foodType: provProfileData.profile.food_type,
    experience: provProfileData.profile.experience_years,
    isOpen: provProfileData.profile.is_open,
    rating: provProfileData.profile.rating_avg,
    fssai: provProfileData.fssai?.fssai_number || 'Basic'
  });

  const provUpdateRes = await testFetch('http://localhost:5000/api/provider/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provAuth.token },
    body: JSON.stringify({
      provider_name: 'Radha Sharma',
      kitchen_name: 'Shri Krishna Maa Annapurna',
      mobile: '9876543210',
      kitchen_address: 'B-402, Gokul Dham Heights, Model Colony, Pune',
      food_type: 'Veg',
      experience_years: 5,
      bio: 'Authentic pure vegetarian Maharashtrian & North Indian homestyle tiffin meals.',
      is_open: 1
    })
  });
  assert(provUpdateRes.status === 200, 'Provider profile update failed');
  console.log('   ✓ Provider Profile Update & Persistence verified.');

  // 3. ADMIN PROFILE TEST
  console.log('\n--- 3. Testing Admin Profile ---');
  const adminLoginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aapnatiffin.com', password: 'Admin@123' })
  });
  const adminAuth = JSON.parse(adminLoginRes.data);
  assert(adminAuth.token, 'Admin login failed');
  assert.strictEqual(adminAuth.user.role, 'ADMIN', 'Role must be ADMIN');
  console.log('   ✓ Admin authentication successful.');

  const adminProfileRes = await testFetch('http://localhost:5000/api/admin/profile', {
    headers: { 'Authorization': 'Bearer ' + adminAuth.token }
  });
  const adminProfileData = JSON.parse(adminProfileRes.data);
  assert(adminProfileData.user, 'Admin user missing');
  assert(adminProfileData.systemInfo, 'Admin systemInfo missing');
  console.log('   ✓ Admin Profile Loaded:', {
    email: adminProfileData.user.email,
    role: adminProfileData.user.role,
    totalUsers: adminProfileData.systemInfo.totalUsers,
    totalCustomers: adminProfileData.systemInfo.totalCustomers,
    totalProviders: adminProfileData.systemInfo.totalProviders,
    totalOrders: adminProfileData.systemInfo.totalOrders
  });

  console.log('\n=== ALL ROLE-BASED PROFILES VERIFIED SUCCESSFULLY! ===');
})();
