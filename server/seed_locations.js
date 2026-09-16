const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');

async function seedLocations() {
  await db.init();
  console.log('[MIGRATION] Ensuring location data & coordinates exist...');

  // Radha Sharma (Model Colony, Pune)
  const radha = db.prepare(`SELECT id FROM provider_profiles WHERE provider_name LIKE '%Radha%'`).get();
  if (radha) {
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5362, 73.8410, 'B-402, Gokul Dham Heights, Model Colony, Pune', 'Pune', 'Model Colony', '411016', 1)
    `).run(uuidv4(), radha.id);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 5.0, NULL, 1)
    `).run(uuidv4(), radha.id);
  }

  // Sarita Deshmukh (Kothrud, Pune)
  const sarita = db.prepare(`SELECT id FROM provider_profiles WHERE provider_name LIKE '%Sarita%'`).get();
  if (sarita) {
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5074, 73.8077, 'Plot 12, Sahakar Nagar, Kothrud, Pune', 'Pune', 'Kothrud', '411038', 1)
    `).run(uuidv4(), sarita.id);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 4.0, NULL, 1)
    `).run(uuidv4(), sarita.id);
  }

  // Anita Patil (Deccan Gymkhana, Pune)
  const anita = db.prepare(`SELECT id FROM provider_profiles WHERE provider_name LIKE '%Anita%'`).get();
  if (anita) {
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5167, 73.8417, 'Near Shivaji Statue, Deccan Gymkhana, Pune', 'Pune', 'Deccan', '411004', 1)
    `).run(uuidv4(), anita.id);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 3.5, NULL, 1)
    `).run(uuidv4(), anita.id);
  }

  // Customer Rohit (FC Road, Shivajinagar)
  const rohit = db.prepare(`SELECT id FROM customer_profiles WHERE full_name LIKE '%Rohit%'`).get();
  if (rohit) {
    db.prepare(`
      INSERT OR REPLACE INTO customer_locations (id, customer_id, latitude, longitude, address, city, area, postal_code, is_current)
      VALUES (?, ?, 18.5314, 73.8446, 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune', 'Pune', 'Shivajinagar', '411005', 1)
    `).run(uuidv4(), rohit.id);
  }

  // Customer Priya (Mayur Colony, Kothrud)
  const priya = db.prepare(`SELECT id FROM customer_profiles WHERE full_name LIKE '%Priya%'`).get();
  if (priya) {
    db.prepare(`
      INSERT OR REPLACE INTO customer_locations (id, customer_id, latitude, longitude, address, city, area, postal_code, is_current)
      VALUES (?, ?, 18.5042, 73.8152, 'Bungalow 4, Mayur Colony, Kothrud, Pune', 'Pune', 'Kothrud', '411038', 1)
    `).run(uuidv4(), priya.id);
  }

  console.log('[MIGRATION] Location data and coordinates seeded successfully!');
}

seedLocations().catch(console.error);
