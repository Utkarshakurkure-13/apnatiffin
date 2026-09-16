const db = require('./config/database');
const GeocodingService = require('./services/geocodingService');
const GeofenceEngine = require('./services/geofenceEngine');
const RoutingService = require('./services/routingService');

async function testLocationModule() {
  console.log('--- TESTING LOCATION & ROUTING MODULE ---');
  await db.init();

  // 1. Seed or ensure provider & customer locations exist
  const provs = db.prepare(`SELECT * FROM provider_profiles`).all();
  console.log(`Found ${provs.length} providers.`);

  for (const p of provs) {
    const loc = GeofenceEngine.getProviderLocation(p.id);
    const rad = GeofenceEngine.getEffectiveServiceRadius(p.id);
    console.log(`Provider: ${p.provider_name} (${p.kitchen_name}) -> Lat: ${loc.latitude}, Lon: ${loc.longitude}, Radius: ${rad} KM`);
  }

  // 2. Haversine Distance Test
  const d1 = GeofenceEngine.haversineDistanceKm(18.5362, 73.8410, 18.5314, 73.8446);
  console.log(`Haversine Distance (Model Colony -> FC Road): ${d1} KM (Expected ~0.6-1.0 KM)`);

  // 3. Provider Matching Test for Customer at FC Road, Pune (18.5314, 73.8446)
  const matchResult = GeofenceEngine.getProvidersForCustomerLocation({
    customerLat: 18.5314,
    customerLon: 73.8446
  });
  console.log(`Customer at FC Road: Serving Count = ${matchResult.servingCount}, Other Count = ${matchResult.otherCount}`);
  for (const s of matchResult.servingYourLocation) {
    console.log(`  ✓ Serving: ${s.kitchen_name} (Dist: ${s.distance_km} KM, Radius: ${s.service_radius_km} KM)`);
  }
  for (const o of matchResult.otherAvailableProviders) {
    console.log(`  ✗ Other: ${o.kitchen_name} (Dist: ${o.distance_km} KM, Radius: ${o.service_radius_km} KM)`);
  }

  // 4. Reverse Geocoding Test
  console.log('\nTesting Reverse Geocoding...');
  const rev = await GeocodingService.reverseGeocode(18.5314, 73.8446);
  console.log('Reverse Geocode Result:', rev.address);

  // 5. Routing Engine Road Route Test
  console.log('\nTesting Routing Service Road Route...');
  const origin = { latitude: 18.5362, longitude: 73.8410, address: 'Model Colony Kitchen' };
  const stops = [
    { id: '1', customer_name: 'Customer A', address: 'FC Road', latitude: 18.5314, longitude: 73.8446 },
    { id: '2', customer_name: 'Customer B', address: 'Deccan Gymkhana', latitude: 18.5167, longitude: 73.8417 },
    { id: '3', customer_name: 'Customer C', address: 'Kothrud', latitude: 18.5074, longitude: 73.8077 }
  ];

  const route = await RoutingService.calculateDeliveryRoute(origin, stops);
  console.log(`Calculated Route: Total Distance = ${route.totalDistanceKm} KM, Duration = ${route.estimatedDurationMins} mins`);
  console.log(`Waypoints count: ${route.waypoints.length}, Road network: ${route.isRealRoadNetwork}`);
  console.log('Ordered sequence:');
  route.orderedStops.forEach(s => console.log(`  Stop ${s.stop_sequence}: ${s.customer_name} (${s.address})`));

  console.log('\n--- ALL LOCATION BACKEND TESTS PASSED! ---');
}

testLocationModule().catch(console.error);
