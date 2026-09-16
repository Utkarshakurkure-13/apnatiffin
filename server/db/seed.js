const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function seed() {
  console.log('[SEED] Initializing database...');
  await db.init();

  console.log('[SEED] Checking if data already exists...');
  const isForce = process.argv.includes('--force') || process.argv.includes('--reset');
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE email = 'admin@aapnatiffin.com'`).get();
  if (existingAdmin && !isForce) {
    console.log('[SEED] Database already contains seed data. (Run with --force to reseed cleanly)');
    return;
  }

  if (isForce) {
    console.log('[SEED] Resetting existing database records for clean re-seed...');
    try {
      db.exec(`
        DELETE FROM delivery_route_stops;
        DELETE FROM delivery_route_records;
        DELETE FROM order_delivery_locations;
        DELETE FROM complaints;
        DELETE FROM chat_reports;
        DELETE FROM audit_logs;
        DELETE FROM chat_messages;
        DELETE FROM chat_conversations;
        DELETE FROM ratings_reviews;
        DELETE FROM customer_rewards;
        DELETE FROM customer_points_ledger;
        DELETE FROM penalty_ledger;
        DELETE FROM provider_payouts;
        DELETE FROM payments;
        DELETE FROM bills;
        DELETE FROM subscription_meals;
        DELETE FROM subscriptions;
        DELETE FROM order_items;
        DELETE FROM orders;
        DELETE FROM menu_items;
        DELETE FROM provider_pricing;
        DELETE FROM provider_fssai_details;
        DELETE FROM provider_kyc_records;
        DELETE FROM provider_bank_accounts;
        DELETE FROM provider_service_areas;
        DELETE FROM provider_locations;
        DELETE FROM customer_locations;
        DELETE FROM provider_profiles;
        DELETE FROM customer_profiles;
        DELETE FROM notifications;
        DELETE FROM admin_settings;
        DELETE FROM users;
      `);
    } catch (e) {
      console.warn('[SEED] Clean warning:', e.message);
    }
  }

  console.log('[SEED] Seeding platform data...');

  const passAdmin = await bcrypt.hash('Admin@123', 10);
  const passProvider = await bcrypt.hash('Provider@123', 10);
  const passCustomer = await bcrypt.hash('Customer@123', 10);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

  const txn = db.transaction(() => {
    // 1. ADMIN SETTINGS
    const settings = [
      { key: 'platform_commission_percent', val: '15', desc: 'Platform commission percentage deducted from gross sales (default: 15%)' },
      { key: 'provider_late_cancellation_penalty_percent', val: '20', desc: 'Late provider cancellation penalty percentage (PENDING PRODUCT DECISION: 20% vs 30%)' },
      { key: 'customer_early_cancellation_deduction_percent', val: '10', desc: 'Customer cancellation deduction within 1 hour (10%)' },
      { key: 'delivery_failure_penalty_percent', val: '20', desc: 'Provider penalty on delivery failure (20%)' },
      { key: 'delivery_failure_penalty_points', val: '10', desc: 'Provider penalty points on delivery failure (10 pts)' },
      { key: 'reward_point_threshold', val: '100', desc: 'Points required to earn 1 Free 1-Day Meal (100 pts)' },
      { key: 'min_order_advance_hours', val: '3', desc: 'Minimum advance order timing in hours before delivery slot (3 hours)' }
    ];
    for (const s of settings) {
      db.prepare(`INSERT OR REPLACE INTO admin_settings (key, value, description) VALUES (?, ?, ?)`).run(s.key, s.val, s.desc);
    }

    // 2. ADMIN USER
    const adminId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'admin@aapnatiffin.com', ?, 'ADMIN', 'en')
    `).run(adminId, passAdmin);

    // 3. PROVIDER 1: Radha Sharma (Shri Krishna Maa Annapurna)
    const prov1UserId = uuidv4();
    const prov1ProfileId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'radha@annapurna.com', ?, 'PROVIDER', 'mr')
    `).run(prov1UserId, passProvider);

    db.prepare(`
      INSERT INTO provider_profiles (id, user_id, provider_name, mobile, kitchen_name, kitchen_address, food_type, experience_years, is_open, bio, rating_avg, total_reviews)
      VALUES (?, ?, 'Radha Sharma', '9822012345', 'Shri Krishna Maa Annapurna', 'B-402, Gokul Dham Heights, Model Colony, Pune', 'Veg', 7, 1, 'Cooking wholesome authentic Satvik and North Indian thalis with cold-pressed oils and pure desi ghee.', 5.0, 1)
    `).run(prov1ProfileId, prov1UserId);

    db.prepare(`
      INSERT INTO provider_bank_accounts (id, provider_id, account_holder, account_number_masked, bank_name, ifsc_code)
      VALUES (?, ?, 'Radha Sharma', 'XXXX-XXXX-4819', 'State Bank of India', 'SBIN0001423')
    `).run(uuidv4(), prov1ProfileId);

    db.prepare(`
      INSERT INTO provider_kyc_records (id, provider_id, aadhaar_masked, pan_masked, kitchen_proof_url, self_declaration_accepted)
      VALUES (?, ?, 'XXXX-XXXX-8921', 'ABCPS8192K', '/uploads/sample_kitchen_1.jpg', 1)
    `).run(uuidv4(), prov1ProfileId);

    db.prepare(`
      INSERT INTO provider_fssai_details (id, provider_id, has_fssai, fssai_number)
      VALUES (?, ?, 1, '11521019000123')
    `).run(uuidv4(), prov1ProfileId);

    db.prepare(`
      INSERT INTO provider_pricing (id, provider_id, single_meal_lunch_price, single_meal_dinner_price, weekly_lunch_sub_price, weekly_both_sub_price, monthly_lunch_sub_price, monthly_both_sub_price, extra_roti_unit_price, auto_pricing_enabled)
      VALUES (?, ?, 110.00, 110.00, 720.00, 1380.00, 2900.00, 5600.00, 10.00, 1)
    `).run(uuidv4(), prov1ProfileId);

    // 4. PROVIDER 2: Sarita Deshmukh (Maa Ki Rasoi)
    const prov2UserId = uuidv4();
    const prov2ProfileId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'sarita@gharkaswad.com', ?, 'PROVIDER', 'hi')
    `).run(prov2UserId, passProvider);

    db.prepare(`
      INSERT INTO provider_profiles (id, user_id, provider_name, mobile, kitchen_name, kitchen_address, food_type, experience_years, is_open, bio, rating_avg, total_reviews)
      VALUES (?, ?, 'Sarita Deshmukh', '9890123456', 'Maa Ki Rasoi - Ghar Ka Swad', 'Plot 12, Sahakar Nagar, Kothrud, Pune', 'Veg', 5, 1, 'Traditional Maharashtrian Poli Bhaji, Puran Poli, and Varan Bhaat prepared fresh everyday.', 0.0, 0)
    `).run(prov2ProfileId, prov2UserId);

    db.prepare(`
      INSERT INTO provider_bank_accounts (id, provider_id, account_holder, account_number_masked, bank_name, ifsc_code)
      VALUES (?, ?, 'Sarita Deshmukh', 'XXXX-XXXX-9182', 'Bank of Maharashtra', 'MAHB0000451')
    `).run(uuidv4(), prov2ProfileId);

    db.prepare(`
      INSERT INTO provider_kyc_records (id, provider_id, aadhaar_masked, pan_masked, kitchen_proof_url, self_declaration_accepted)
      VALUES (?, ?, 'XXXX-XXXX-3341', 'BDKPD4810M', '/uploads/sample_kitchen_2.jpg', 1)
    `).run(uuidv4(), prov2ProfileId);

    db.prepare(`
      INSERT INTO provider_fssai_details (id, provider_id, has_fssai, fssai_number)
      VALUES (?, ?, 0, NULL)
    `).run(uuidv4(), prov2ProfileId);

    db.prepare(`
      INSERT INTO provider_pricing (id, provider_id, single_meal_lunch_price, single_meal_dinner_price, weekly_lunch_sub_price, weekly_both_sub_price, monthly_lunch_sub_price, monthly_both_sub_price, extra_roti_unit_price)
      VALUES (?, ?, 100.00, 100.00, 680.00, 1300.00, 2700.00, 5200.00, 10.00)
    `).run(uuidv4(), prov2ProfileId);

    // 5. PROVIDER 3: Anita Patil (Swad Maharashtra)
    const prov3UserId = uuidv4();
    const prov3ProfileId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'anita@swadmaharashtra.com', ?, 'PROVIDER', 'mr')
    `).run(prov3UserId, passProvider);

    db.prepare(`
      INSERT INTO provider_profiles (id, user_id, provider_name, mobile, kitchen_name, kitchen_address, food_type, experience_years, is_open, bio, rating_avg, total_reviews)
      VALUES (?, ?, 'Anita Patil', '9765432100', 'Swad Maharashtra Tiffin Center', 'Near Shivaji Statue, Deccan Gymkhana, Pune', 'Both', 4, 1, 'Authentic Kolhapuri style chicken rassa, sukka mutton on weekends and spicy veg thalis on weekdays.', 0.0, 0)
    `).run(prov3ProfileId, prov3UserId);

    db.prepare(`
      INSERT INTO provider_bank_accounts (id, provider_id, account_holder, account_number_masked, bank_name, ifsc_code)
      VALUES (?, ?, 'Anita Patil', 'XXXX-XXXX-7721', 'HDFC Bank', 'HDFC0001290')
    `).run(uuidv4(), prov3ProfileId);

    db.prepare(`
      INSERT INTO provider_kyc_records (id, provider_id, aadhaar_masked, pan_masked, kitchen_proof_url, self_declaration_accepted)
      VALUES (?, ?, 'XXXX-XXXX-5512', 'CKPPA3319L', '/uploads/sample_kitchen_3.jpg', 1)
    `).run(uuidv4(), prov3ProfileId);

    db.prepare(`
      INSERT INTO provider_fssai_details (id, provider_id, has_fssai, fssai_number)
      VALUES (?, ?, 1, '21523091000492')
    `).run(uuidv4(), prov3ProfileId);

    db.prepare(`
      INSERT INTO provider_pricing (id, provider_id, single_meal_lunch_price, single_meal_dinner_price, weekly_lunch_sub_price, weekly_both_sub_price, monthly_lunch_sub_price, monthly_both_sub_price, extra_roti_unit_price)
      VALUES (?, ?, 130.00, 130.00, 850.00, 1650.00, 3400.00, 6500.00, 12.00)
    `).run(uuidv4(), prov3ProfileId);

    // 6. DISHES & MENU ITEMS (Individual Specific Food Items)
    const dishes = [
      // Radha's Specific Dishes
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Dal Fry', desc: 'Slow-simmered yellow arhar dal tempered with garlic, cumin, and pure desi ghee.', price: 90, spec: 1, date: today, prep: 68 },
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Matar Paneer', desc: 'Fresh cottage cheese cubes and green peas in rich homestyle tomato gravy.', price: 110, spec: 1, date: today, prep: 42 },
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Phulka Roti', desc: 'Soft whole wheat phulkas cooked on direct flame with pure ghee.', price: 10, spec: 0, date: today, prep: 75 },
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Steamed Rice', desc: 'Aromatic long-grain basmati rice steamed fresh.', price: 80, spec: 0, date: today, prep: 60 },
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Aloo Gobi', desc: 'Cauliflower florets and potatoes cooked with cumin, ginger, and turmeric.', price: 90, spec: 0, date: today, prep: 35 },
      { pId: prov1ProfileId, type: 'DINNER', name: 'Dal Makhani', desc: 'Slow-cooked black lentils simmered overnight with butter and fresh cream.', price: 120, spec: 1, date: today, prep: 54 },
      { pId: prov1ProfileId, type: 'DINNER', name: 'Paneer Butter Masala', desc: 'Velvety cottage cheese in aromatic butter tomato gravy.', price: 130, spec: 1, date: today, prep: 48 },
      { pId: prov1ProfileId, type: 'DINNER', name: 'Mix Veg', desc: 'Seasonal carrots, beans, peas, and cauliflower tossed in subtle whole spices.', price: 100, spec: 0, date: today, prep: 28 },
      
      // Yesterday Radha's Dishes
      { pId: prov1ProfileId, type: 'LUNCH', name: 'Palak Paneer', desc: 'Fresh spinach puree with soft paneer cubes.', price: 110, spec: 1, date: yesterday, prep: 40 },
      { pId: prov1ProfileId, type: 'DINNER', name: 'Baingan Bharta', desc: 'Smoked roasted aubergine mash cooked with ginger and green chillies.', price: 100, spec: 0, date: yesterday, prep: 22 },

      // Sarita's Specific Dishes
      { pId: prov2ProfileId, type: 'LUNCH', name: 'Varan Bhaat', desc: 'Homestyle thick Maharashtrian yellow dal with steamed rice and pure ghee.', price: 90, spec: 1, date: today, prep: 65 },
      { pId: prov2ProfileId, type: 'LUNCH', name: 'Batata Bhaji', desc: 'Homestyle spiced yellow potato sabzi with curry leaves and mustard seeds.', price: 80, spec: 0, date: today, prep: 50 },
      { pId: prov2ProfileId, type: 'LUNCH', name: 'Poli Roti', desc: 'Traditional paper-thin Maharashtrian wheat polis.', price: 10, spec: 0, date: today, prep: 70 },
      { pId: prov2ProfileId, type: 'LUNCH', name: 'Kadhi Pakoda', desc: 'Buttermilk kadhi with crispy methi pakodas.', price: 90, spec: 0, date: today, prep: 34 },
      { pId: prov2ProfileId, type: 'DINNER', name: 'Sev Bhaji', desc: 'Spicy Khandeshi sev curry in rich coconut onion gravy.', price: 100, spec: 1, date: today, prep: 48 },
      { pId: prov2ProfileId, type: 'DINNER', name: 'Moong Dal Khichdi', desc: 'Light comforting khichdi tempered with cumin and ghee.', price: 90, spec: 0, date: today, prep: 38 },
      { pId: prov2ProfileId, type: 'DINNER', name: 'Jowar Bhakri', desc: 'Hot healthy roasted jowar flatbread.', price: 15, spec: 0, date: today, prep: 55 },

      // Anita's Specific Dishes
      { pId: prov3ProfileId, type: 'LUNCH', name: 'Chicken Curry', desc: 'Tender chicken pieces in Kolhapuri stone-ground spiced coconut gravy.', price: 140, spec: 1, date: today, prep: 62 },
      { pId: prov3ProfileId, type: 'LUNCH', name: 'Jowar Bhakri', desc: 'Freshly roasted whole jowar flatbread.', price: 15, spec: 0, date: today, prep: 68 },
      { pId: prov3ProfileId, type: 'LUNCH', name: 'Jeera Rice', desc: 'Basmati rice tempered with roasted cumin seeds.', price: 80, spec: 0, date: today, prep: 55 },
      { pId: prov3ProfileId, type: 'LUNCH', name: 'Paneer Kolhapuri', desc: 'Fiery cottage cheese in roasted Kolhapuri spices.', price: 120, spec: 0, date: today, prep: 38 },
      { pId: prov3ProfileId, type: 'DINNER', name: 'Egg Curry', desc: 'Boiled egg masala in spiced onion-tomato gravy.', price: 110, spec: 1, date: today, prep: 45 },
      { pId: prov3ProfileId, type: 'DINNER', name: 'Dal Tadka', desc: 'Garlic-tempered yellow lentils.', price: 90, spec: 0, date: today, prep: 40 }
    ];

    for (const d of dishes) {
      db.prepare(`
        INSERT INTO menu_items (id, provider_id, meal_type, name, description, price, is_speciality, is_available, prep_count, menu_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(uuidv4(), d.pId, d.type, d.name, d.desc, d.price, d.spec, d.prep, d.date);
    }

    // 7. CUSTOMER 1: Rohit Sharma
    const cust1UserId = uuidv4();
    const cust1ProfileId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'rohit@gmail.com', ?, 'CUSTOMER', 'en')
    `).run(cust1UserId, passCustomer);

    db.prepare(`
      INSERT INTO customer_profiles (id, user_id, full_name, mobile, delivery_address)
      VALUES (?, ?, 'Rohit Sharma', '9819001122', 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune')
    `).run(cust1ProfileId, cust1UserId);

    // 8. CUSTOMER 2: Priya Patel
    const cust2UserId = uuidv4();
    const cust2ProfileId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, 'priya@gmail.com', ?, 'CUSTOMER', 'hi')
    `).run(cust2UserId, passCustomer);

    db.prepare(`
      INSERT INTO customer_profiles (id, user_id, full_name, mobile, delivery_address)
      VALUES (?, ?, 'Priya Patel', '9823445566', 'Bungalow 4, Mayur Colony, Kothrud, Pune')
    `).run(cust2ProfileId, cust2UserId);

    // 9. SEED ACTIVE ORDER for Rohit (Today's Lunch - Status: PREPARING, with 4-Digit OTP: 4829)
    const activeOrderId = uuidv4();
    const activeOrderNum = 'APT-849201';
    const scheduledLunch = new Date();
    scheduledLunch.setHours(13, 0, 0, 0);

    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, provider_id, meal_type, plan_type, num_meals,
        extra_roti_count, base_amount, extra_roti_amount, charges_amount, discount_amount, final_amount,
        order_status, payment_status, delivery_otp, delivery_scheduled_time, special_instructions
      ) VALUES (?, ?, ?, ?, 'LUNCH', 'SINGLE', 1, 2, 110.00, 20.00, 0.00, 0.00, 130.00, 'PREPARING', 'SUCCESS', '4829', ?, 'Please make dal less spicy.')
    `).run(activeOrderId, activeOrderNum, cust1ProfileId, prov1ProfileId, scheduledLunch.toISOString());

    // Customer Bill for Active Order
    db.prepare(`
      INSERT INTO bills (
        id, bill_number, order_id, customer_id, provider_id, bill_type, plan_meal_name,
        meal_slot, extra_roti_count, base_amount, charges, discount, gross_amount,
        final_payable, payment_method, gateway, transaction_id, payment_status
      ) VALUES (?, 'BILL-CUST-849201', ?, ?, ?, 'CUSTOMER', '1-Day Special Thali', 'LUNCH', 2, 110.00, 0.00, 0.00, 130.00, 130.00, 'UPI', 'Razorpay Mock', 'TXN-91823-1', 'SUCCESS')
    `).run(uuidv4(), activeOrderId, cust1ProfileId, prov1ProfileId);

    // Provider Bill for Active Order (15% platform commission)
    db.prepare(`
      INSERT INTO bills (
        id, bill_number, order_id, customer_id, provider_id, bill_type, plan_meal_name,
        meal_slot, extra_roti_count, base_amount, charges, discount, gross_amount,
        platform_commission, final_payable, payment_method, gateway, transaction_id, payment_status
      ) VALUES (?, 'BILL-PROV-849201', ?, ?, ?, 'PROVIDER', '1-Day Special Thali', 'LUNCH', 2, 110.00, 0.00, 0.00, 130.00, 19.50, 110.50, 'UPI', 'Razorpay Mock', 'TXN-91823-1', 'SUCCESS')
    `).run(uuidv4(), activeOrderId, cust1ProfileId, prov1ProfileId);

    // 10. SEED PAST DELIVERED ORDER for Rohit (Reviewed with 5 stars)
    const pastOrderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, provider_id, meal_type, plan_type, num_meals,
        extra_roti_count, base_amount, extra_roti_amount, charges_amount, discount_amount, final_amount,
        order_status, payment_status, delivery_otp, otp_verified_at, delivery_scheduled_time, special_instructions
      ) VALUES (?, 'APT-738192', ?, ?, 'LUNCH', 'SINGLE', 1, 0, 110.00, 0.00, 0.00, 0.00, 110.00, 'DELIVERED', 'SUCCESS', '5912', CURRENT_TIMESTAMP, ?, 'Extra salad please.')
    `).run(pastOrderId, cust1ProfileId, prov1ProfileId, yesterday);

    db.prepare(`
      INSERT INTO bills (
        id, bill_number, order_id, customer_id, provider_id, bill_type, plan_meal_name,
        meal_slot, extra_roti_count, base_amount, charges, discount, gross_amount,
        final_payable, payment_method, gateway, transaction_id, payment_status
      ) VALUES (?, 'BILL-CUST-738192', ?, ?, ?, 'CUSTOMER', '1-Day Special Thali', 'LUNCH', 0, 110.00, 0.00, 0.00, 110.00, 110.00, 'UPI', 'Razorpay Mock', 'TXN-82711-2', 'SUCCESS')
    `).run(uuidv4(), pastOrderId, cust1ProfileId, prov1ProfileId);

    db.prepare(`
      INSERT INTO ratings_reviews (id, order_id, customer_id, provider_id, rating, review_text, points_awarded)
      VALUES (?, ?, ?, ?, 5, 'The food tasted exactly like home! Hot soft phulkas and fresh dal tadka. Highly recommended.', 5)
    `).run(uuidv4(), pastOrderId, cust1ProfileId, prov1ProfileId);

    // 11. SEED SUBSCRIPTIONS & CALENDAR MEALS
    // (A) Priya Patel - Weekly Both (Started 2 days ago)
    const priyaSubId = uuidv4();
    const priyaOrderId = uuidv4();
    const priyaStart = twoDaysAgo;
    const priyaParts = priyaStart.split('-').map(p => parseInt(p, 10));
    const priyaStartDateObj = new Date(Date.UTC(priyaParts[0], priyaParts[1] - 1, priyaParts[2]));
    const priyaEndDateObj = new Date(priyaStartDateObj);
    priyaEndDateObj.setUTCDate(priyaEndDateObj.getUTCDate() + 6);
    const priyaEnd = priyaEndDateObj.toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, provider_id, meal_type, plan_type, num_meals,
        extra_roti_count, base_amount, extra_roti_amount, charges_amount, discount_amount, final_amount,
        order_status, payment_status, delivery_otp, delivery_scheduled_time
      ) VALUES (?, 'APT-662910', ?, ?, 'BOTH', 'WEEKLY', 14, 1, 1300.00, 70.00, 0.00, 0.00, 1370.00, 'ACCEPTED', 'SUCCESS', '9102', ?)
    `).run(priyaOrderId, cust2ProfileId, prov2ProfileId, priyaStart);

    db.prepare(`
      INSERT INTO subscriptions (
        id, customer_id, provider_id, order_id, plan_type, meal_type, start_date, expiry_date,
        total_lunch, used_lunch, total_dinner, used_dinner, extra_roti_per_meal, status
      ) VALUES (?, ?, ?, ?, 'WEEKLY', 'BOTH', ?, ?, 7, 2, 7, 2, 1, 'ACTIVE')
    `).run(priyaSubId, cust2ProfileId, prov2ProfileId, priyaOrderId, priyaStart, priyaEnd);

    // Generate dates for Priya
    const priyaDates = [];
    let curP = new Date(priyaStartDateObj);
    while (curP <= priyaEndDateObj) {
      priyaDates.push(curP.toISOString().split('T')[0]);
      curP.setUTCDate(curP.getUTCDate() + 1);
    }

    const sampleLunchMenu = JSON.stringify([
      { name: 'Traditional Maharashtrian Thali (3 Poli, Batata Bhaji, Varan Bhaat)', description: 'Homestyle wheat polis, spiced potato bhaji, thick dal and steamed rice.', isSpeciality: true },
      { name: 'Fresh Cucumber Salad & Lemon Pickle', description: 'Fresh crisp salad with homemade lemon pickle.', isSpeciality: false }
    ]);
    const sampleDinnerMenu = JSON.stringify([
      { name: 'Sev Bhaji + 3 Jowar Bhakri + Thecha', description: 'Spicy Khandeshi sev curry with hot jowar flatbread.', isSpeciality: true },
      { name: 'Moong Dal Khichdi & Ghee', description: 'Light comforting khichdi tempered with cumin and pure ghee.', isSpeciality: false }
    ]);

    for (let i = 0; i < priyaDates.length; i++) {
      const d = priyaDates[i];
      let lunchStatus = 'CONFIRMED';
      let lunchDelStatus = 'PENDING';
      let lunchDelTime = null;
      let lunchCancel = null;
      let lunchReason = null;
      let lunchRefund = 0.0;

      let dinnerStatus = 'CONFIRMED';
      let dinnerDelStatus = 'PENDING';
      let dinnerDelTime = null;
      let dinnerCancel = null;
      let dinnerReason = null;
      let dinnerRefund = 0.0;

      if (d < today) {
        // Past days delivered
        lunchStatus = 'DELIVERED';
        lunchDelStatus = 'DELIVERED';
        lunchDelTime = `${d} 13:15:00`;
        dinnerStatus = 'DELIVERED';
        dinnerDelStatus = 'DELIVERED';
        dinnerDelTime = `${d} 20:30:00`;
      } else if (d === today) {
        // Today's Lunch is Out / Preparing, Dinner is Confirmed
        lunchStatus = 'PREPARING';
        lunchDelStatus = 'PENDING';
        dinnerStatus = 'CONFIRMED';
        dinnerDelStatus = 'PENDING';
      } else if (i === 4) {
        // Day 4 cancelled to demonstrate cancelled date persistence
        lunchStatus = 'CANCELLED';
        lunchDelStatus = 'CANCELLED';
        lunchCancel = 'CANCELLED_BY_CUSTOMER';
        lunchReason = 'Traveling to Mumbai for office conference';
        lunchRefund = 97.85;

        dinnerStatus = 'CANCELLED';
        dinnerDelStatus = 'CANCELLED';
        dinnerCancel = 'CANCELLED_BY_CUSTOMER';
        dinnerReason = 'Traveling to Mumbai for office conference';
        dinnerRefund = 97.85;
      }

      // Insert Lunch
      db.prepare(`
        INSERT INTO subscription_meals (
          id, subscription_id, meal_date, meal_type, order_id, menu_snapshot,
          extra_roti_quantity, status, cancellation_status, cancellation_reason,
          refund_amount, delivery_status, delivery_time, delivery_otp
        ) VALUES (?, ?, ?, 'LUNCH', ?, ?, 1, ?, ?, ?, ?, ?, ?, '9102')
      `).run(uuidv4(), priyaSubId, d, priyaOrderId, sampleLunchMenu, lunchStatus, lunchCancel, lunchReason, lunchRefund, lunchDelStatus, lunchDelTime);

      // Insert Dinner
      db.prepare(`
        INSERT INTO subscription_meals (
          id, subscription_id, meal_date, meal_type, order_id, menu_snapshot,
          extra_roti_quantity, status, cancellation_status, cancellation_reason,
          refund_amount, delivery_status, delivery_time, delivery_otp
        ) VALUES (?, ?, ?, 'DINNER', ?, ?, 1, ?, ?, ?, ?, ?, ?, '9102')
      `).run(uuidv4(), priyaSubId, d, priyaOrderId, sampleDinnerMenu, dinnerStatus, dinnerCancel, dinnerReason, dinnerRefund, dinnerDelStatus, dinnerDelTime);
    }

    // (B) Rohit Sharma - Monthly Lunch Subscription (Started 3 days ago)
    const rohitSubId = uuidv4();
    const rohitSubOrderId = uuidv4();
    const rohitStart = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const rohitStartParts = rohitStart.split('-').map(p => parseInt(p, 10));
    const rohitStartDateObj = new Date(Date.UTC(rohitStartParts[0], rohitStartParts[1] - 1, rohitStartParts[2]));
    
    // Monthly calculation: Next month same date - 1 day
    const rohitYear = rohitStartParts[0];
    const rohitMonth = rohitStartParts[1] - 1;
    const rohitTargetYear = rohitMonth === 11 ? rohitYear + 1 : rohitYear;
    const rohitTargetMonth = (rohitMonth + 1) % 12;
    const daysInTargetMonth = new Date(Date.UTC(rohitTargetYear, rohitTargetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(rohitStartParts[2], daysInTargetMonth);
    const rohitNextMonth = new Date(Date.UTC(rohitTargetYear, rohitTargetMonth, clampedDay));
    rohitNextMonth.setUTCDate(rohitNextMonth.getUTCDate() - 1);
    const rohitEnd = rohitNextMonth.toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, provider_id, meal_type, plan_type, num_meals,
        extra_roti_count, base_amount, extra_roti_amount, charges_amount, discount_amount, final_amount,
        order_status, payment_status, delivery_otp, delivery_scheduled_time
      ) VALUES (?, 'APT-992014', ?, ?, 'LUNCH', 'MONTHLY', 30, 2, 2900.00, 600.00, 0.00, 0.00, 3500.00, 'ACCEPTED', 'SUCCESS', '4829', ?)
    `).run(rohitSubOrderId, cust1ProfileId, prov1ProfileId, rohitStart);

    const rohitDates = [];
    let curR = new Date(rohitStartDateObj);
    while (curR <= rohitNextMonth) {
      rohitDates.push(curR.toISOString().split('T')[0]);
      curR.setUTCDate(curR.getUTCDate() + 1);
    }

    db.prepare(`
      INSERT INTO subscriptions (
        id, customer_id, provider_id, order_id, plan_type, meal_type, start_date, expiry_date,
        total_lunch, used_lunch, total_dinner, used_dinner, extra_roti_per_meal, status
      ) VALUES (?, ?, ?, ?, 'MONTHLY', 'LUNCH', ?, ?, ?, 3, 0, 0, 2, 'ACTIVE')
    `).run(rohitSubId, cust1ProfileId, prov1ProfileId, rohitSubOrderId, rohitStart, rohitEnd, rohitDates.length);

    const rohitLunchMenu = JSON.stringify([
      { name: 'Shahi Paneer Butter Masala & 4 Ghee Phulkas', description: 'Cottage cheese in velvety cashew gravy with ghee phulkas.', isSpeciality: true },
      { name: 'Yellow Dal Tadka & Jeera Basmati Rice', description: 'Garlic tempered lentils with long grain fragrant rice.', isSpeciality: true },
      { name: 'Aloo Gobi Adraki + Salad', description: 'Spiced ginger cauliflower and potatoes.', isSpeciality: false }
    ]);

    for (let i = 0; i < rohitDates.length; i++) {
      const d = rohitDates[i];
      let rStatus = 'CONFIRMED';
      let rDelStatus = 'PENDING';
      let rDelTime = null;
      let rCancel = null;
      let rReason = null;
      let rRefund = 0.0;

      if (d < today) {
        rStatus = 'DELIVERED';
        rDelStatus = 'DELIVERED';
        rDelTime = `${d} 13:00:00`;
      } else if (d === today) {
        rStatus = 'PREPARING';
        rDelStatus = 'PENDING';
      } else if (i === 8) {
        // Cancelled future day
        rStatus = 'CANCELLED';
        rDelStatus = 'CANCELLED';
        rCancel = 'CANCELLED_BY_CUSTOMER';
        rReason = 'Doctor appointment out of station';
        rRefund = 116.66;
      }

      db.prepare(`
        INSERT INTO subscription_meals (
          id, subscription_id, meal_date, meal_type, order_id, menu_snapshot,
          extra_roti_quantity, status, cancellation_status, cancellation_reason,
          refund_amount, delivery_status, delivery_time, delivery_otp
        ) VALUES (?, ?, ?, 'LUNCH', ?, ?, 2, ?, ?, ?, ?, ?, ?, '4829')
      `).run(uuidv4(), rohitSubId, d, rohitSubOrderId, rohitLunchMenu, rStatus, rCancel, rReason, rRefund, rDelStatus, rDelTime);
    }

    // 12. CUSTOMER POINTS & 100-POINT MILESTONE REWARD
    // Seed Rohit with 105 points to demonstrate milestone unlock
    db.prepare(`
      INSERT INTO customer_points_ledger (id, customer_id, order_id, points_change, reason, balance_after)
      VALUES (?, ?, NULL, 10, 'Welcome Registration Bonus', 10)
    `).run(uuidv4(), cust1ProfileId);

    db.prepare(`
      INSERT INTO customer_points_ledger (id, customer_id, order_id, points_change, reason, balance_after)
      VALUES (?, ?, ?, 5, 'Review for Order #APT-738192', 15)
    `).run(uuidv4(), cust1ProfileId, pastOrderId);

    db.prepare(`
      INSERT INTO customer_points_ledger (id, customer_id, order_id, points_change, reason, balance_after)
      VALUES (?, ?, NULL, 90, 'Milestone Loyalty Loyalty Points', 105)
    `).run(uuidv4(), cust1ProfileId);

    // 100-Point Free 1-Day Meal Voucher
    db.prepare(`
      INSERT INTO customer_rewards (id, customer_id, milestone_points, reward_code, reward_type, free_meal_value, is_redeemed, provider_reimbursement_amount)
      VALUES (?, ?, 100, 'FREE-MEAL-100-DELIGHT', 'FREE_1_DAY_MEAL', 110.00, 0, 110.00)
    `).run(uuidv4(), cust1ProfileId);

    // 13. CHAT CONVERSATION
    const convId = uuidv4();
    db.prepare(`
      INSERT INTO chat_conversations (id, customer_id, provider_id, topic, custom_subject)
      VALUES (?, ?, ?, 'Menu', 'Jain food availability on Tuesday')
    `).run(convId, cust1ProfileId, prov1ProfileId);

    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, sender_id, sender_role, message_text)
      VALUES (?, ?, ?, 'CUSTOMER', 'Namaste Radha ji, do you prepare Jain without onion/garlic on Tuesdays?')
    `).run(uuidv4(), convId, cust1UserId);

    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, sender_id, sender_role, message_text)
      VALUES (?, ?, ?, 'PROVIDER', 'Yes Rohit ji! We have a separate Satvik Jain thali prepared fresh without onion and garlic.')
    `).run(uuidv4(), convId, prov1UserId);

    // 14. SAMPLE COMPLAINT
    db.prepare(`
      INSERT INTO complaints (id, ticket_number, reporter_id, reported_id, order_id, category, description, status, resolution_notes)
      VALUES (?, 'TKT-948102', ?, ?, ?, 'Packaging', 'Container lid was loose, slight gravy leakage.', 'RESOLVED', 'Provider warned to use sealed heat-wrap packaging.')
    `).run(uuidv4(), cust1UserId, prov1UserId, pastOrderId);

    // 15. PROVIDER LOCATIONS & SERVICE AREAS
    // Radha Sharma (Model Colony, Pune)
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5362, 73.8410, 'B-402, Gokul Dham Heights, Model Colony, Pune', 'Pune', 'Model Colony', '411016', 1)
    `).run(uuidv4(), prov1ProfileId);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 5.0, NULL, 1)
    `).run(uuidv4(), prov1ProfileId);

    // Sarita Deshmukh (Kothrud, Pune)
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5074, 73.8077, 'Plot 12, Sahakar Nagar, Kothrud, Pune', 'Pune', 'Kothrud', '411038', 1)
    `).run(uuidv4(), prov2ProfileId);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 4.0, NULL, 1)
    `).run(uuidv4(), prov2ProfileId);

    // Anita Patil (Deccan Gymkhana, Pune)
    db.prepare(`
      INSERT OR REPLACE INTO provider_locations (id, provider_id, latitude, longitude, address, city, area, postal_code, is_primary)
      VALUES (?, ?, 18.5167, 73.8417, 'Near Shivaji Statue, Deccan Gymkhana, Pune', 'Pune', 'Deccan', '411004', 1)
    `).run(uuidv4(), prov3ProfileId);

    db.prepare(`
      INSERT OR REPLACE INTO provider_service_areas (id, provider_id, radius_km, effective_date, is_active)
      VALUES (?, ?, 3.5, NULL, 1)
    `).run(uuidv4(), prov3ProfileId);

    // 16. CUSTOMER LOCATIONS
    // Rohit Sharma (Shivajinagar, FC Road, Pune)
    db.prepare(`
      INSERT OR REPLACE INTO customer_locations (id, customer_id, latitude, longitude, address, city, area, postal_code, is_current)
      VALUES (?, ?, 18.5314, 73.8446, 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune', 'Pune', 'Shivajinagar', '411005', 1)
    `).run(uuidv4(), cust1ProfileId);

    // Priya Patel (Mayur Colony, Kothrud, Pune)
    db.prepare(`
      INSERT OR REPLACE INTO customer_locations (id, customer_id, latitude, longitude, address, city, area, postal_code, is_current)
      VALUES (?, ?, 18.5042, 73.8152, 'Bungalow 4, Mayur Colony, Kothrud, Pune', 'Pune', 'Kothrud', '411038', 1)
    `).run(uuidv4(), cust2ProfileId);

    // 17. ORDER DELIVERY LOCATION SNAPSHOTS
    db.prepare(`
      INSERT OR REPLACE INTO order_delivery_locations (id, order_id, latitude, longitude, address, city, area, postal_code)
      VALUES (?, ?, 18.5314, 73.8446, 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune', 'Pune', 'Shivajinagar', '411005')
    `).run(uuidv4(), activeOrderId);

    db.prepare(`
      INSERT OR REPLACE INTO order_delivery_locations (id, order_id, latitude, longitude, address, city, area, postal_code)
      VALUES (?, ?, 18.5314, 73.8446, 'Flat 501, Silver Oak Society, F.C. Road, Shivajinagar, Pune', 'Pune', 'Shivajinagar', '411005')
    `).run(uuidv4(), pastOrderId);
  });

  txn();
  console.log('[SEED] Platform database seeded successfully with Admin, Providers, Customers, Menus, Orders, and Settings!');
}

seed().catch(err => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
