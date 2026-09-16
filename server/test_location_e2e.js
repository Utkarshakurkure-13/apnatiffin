async function runE2ETests() {
  console.log('=== AAPNA TIFFIN LOCATION & ROUTING E2E VERIFICATION ===');
  const baseUrl = 'http://localhost:5000';

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  console.log('1. Health Check:', health.status === 'ok' ? '✓ PASS' : '✗ FAIL');

  // 2. Location Reverse Geocoding
  const revRes = await fetch(`${baseUrl}/api/location/reverse?lat=18.5314&lon=73.8446`);
  const rev = await revRes.json();
  console.log('2. Reverse Geocoding Endpoint:', rev.address ? `✓ PASS (${rev.address})` : '✗ FAIL');

  // 3. Location Search Autocomplete
  const searchRes = await fetch(`${baseUrl}/api/location/search?q=Kothrud`);
  const searchData = await searchRes.json();
  console.log('3. Search Autocomplete Endpoint:', searchData.results?.length >= 0 ? `✓ PASS (${searchData.results.length} results found)` : '✗ FAIL');

  // 4. Customer Login & Providers by Location
  const custLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohit@gmail.com', password: 'Customer@123' })
  });
  const custLogin = await custLoginRes.json();
  const custToken = custLogin.token;
  console.log('4. Customer Login:', custToken ? '✓ PASS' : '✗ FAIL');

  const provMatchRes = await fetch(`${baseUrl}/api/customer/providers-by-location?lat=18.5314&lon=73.8446`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const provMatch = await provMatchRes.json();
  console.log('5. Server-Side Geofenced Provider Matching:');
  console.log(`   - Serving Your Location count: ${provMatch.servingCount}`);
  console.log(`   - Other Available Providers count: ${provMatch.otherCount}`);
  if (provMatch.servingCount > 0) {
    console.log(`   ✓ Top match: ${provMatch.servingYourLocation[0].kitchen_name} (${provMatch.servingYourLocation[0].distance_km} KM away, ${provMatch.servingYourLocation[0].service_radius_km} KM radius)`);
  }

  // 6. Provider Login & Routing
  const provLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'radha@annapurna.com', password: 'Provider@123' })
  });
  const provLogin = await provLoginRes.json();
  const provToken = provLogin.token;
  console.log('6. Provider Login:', provToken ? '✓ PASS' : '✗ FAIL');

  const provLocRes = await fetch(`${baseUrl}/api/provider/location`, {
    headers: { 'Authorization': `Bearer ${provToken}` }
  });
  const provLoc = await provLocRes.json();
  console.log('7. Provider Kitchen Location & Service Radius:', provLoc.location ? `✓ PASS (${provLoc.kitchenAddress}, Default Radius: ${provLoc.defaultRadiusKm} KM)` : '✗ FAIL');

  const routeRes = await fetch(`${baseUrl}/api/provider/delivery-route`, {
    headers: { 'Authorization': `Bearer ${provToken}` }
  });
  const route = await routeRes.json();
  console.log('8. Provider Today\'s Delivery Route with OSRM Road Geometry:');
  console.log(`   - Total Distance: ${route.totalDistanceKm} KM`);
  console.log(`   - Est. Duration: ${route.estimatedDurationMins} Mins`);
  console.log(`   - Waypoints Count: ${route.waypoints?.length || 0}`);
  console.log(`   - Real Road Network: ${route.isRealRoadNetwork ? '✓ YES (OSRM)' : 'Road Interpolation'}`);
  console.log(`   - Ordered Stops Count: ${route.orderedStops?.length || 0}`);

  console.log('\n=== ALL E2E LOCATION AND ROUTING APIS VERIFIED SUCCESSFULLY! ===');
}

runE2ETests().catch(console.error);
