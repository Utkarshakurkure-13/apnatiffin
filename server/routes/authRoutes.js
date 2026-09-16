const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { JWT_SECRET, authenticateJWT } = require('../middleware/auth');
const NotificationEngine = require('../services/notificationEngine');

// Store simulated email OTPs in memory
const emailOtpStore = new Map();

/**
 * POST /api/auth/send-otp
 */
router.post('/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  // Check if email already registered
  const existingUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (existingUser) {
    return res.status(400).json({ error: 'This email is already registered. Please log in.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  emailOtpStore.set(email.toLowerCase().trim(), {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  console.log(`[AUTH OTP] Simulated OTP for ${email}: ${otp}`);

  return res.json({
    success: true,
    message: 'Verification OTP sent to email successfully.',
    devOtp: otp // Included for testing ease
  });
});

/**
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const stored = emailOtpStore.get(email.toLowerCase().trim());
  if (!stored || stored.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (stored.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid verification OTP. Please check and try again.' });
  }

  return res.json({ success: true, message: 'Email verified successfully.' });
});

/**
 * POST /api/auth/login - ONE COMMON LOGIN FOR ALL ROLES
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email and password.' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.is_blocked === 1) {
    return res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  let profile = null;
  if (user.role === 'CUSTOMER') {
    profile = db.prepare(`SELECT * FROM customer_profiles WHERE user_id = ?`).get(user.id);
  } else if (user.role === 'PROVIDER') {
    profile = db.prepare(`SELECT * FROM provider_profiles WHERE user_id = ?`).get(user.id);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, 'USER_LOGIN', 'USER', ?, ?)
  `).run(uuidv4(), user.id, user.id, JSON.stringify({ role: user.role }));

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      preferred_language: user.preferred_language
    },
    profile
  });
});

/**
 * POST /api/auth/register/customer
 */
router.post('/register/customer', async (req, res) => {
  const { full_name, email, password, mobile, delivery_address, preferred_language = 'en', otp } = req.body;

  if (!full_name || !email || !password || !mobile || !delivery_address) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate OTP if provided in production flow
  if (otp) {
    const stored = emailOtpStore.get(email.toLowerCase().trim());
    if (!stored || stored.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }
    emailOtpStore.delete(email.toLowerCase().trim());
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'Email already registered. Please log in.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const customerProfileId = uuidv4();

  const txn = db.transaction(() => {
    // 1. Create User
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, ?, ?, 'CUSTOMER', ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash, preferred_language);

    // 2. Create Customer Profile
    db.prepare(`
      INSERT INTO customer_profiles (id, user_id, full_name, mobile, delivery_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerProfileId, userId, full_name, mobile, delivery_address);

    // 3. Welcome Notification
    NotificationEngine.sendNotification({
      userId,
      type: 'SYSTEM',
      soundType: 'notification',
      title_en: 'Welcome to Aapna Tiffin! 🍱',
      title_mr: 'आपला टिफिन मध्ये आपले स्वागत आहे! 🍱',
      title_hi: 'अपना टिफिन में आपका स्वागत है! 🍱',
      message_en: `Hello ${full_name}! Explore home-cooked meals from passionate local chefs and place your first order.`,
      message_mr: `नमस्कार ${full_name}! घरगुती स्वयंपाकी शोधा आणि तुमचा पहिला डबा ऑर्डर करा.`,
      message_hi: `नमस्ते ${full_name}! स्वादिष्ट घर का खाना खोजें और अपना पहला टिफिन ऑर्डर करें।`,
      link: '/customer'
    });

    // Admin Notification
    NotificationEngine.notifyAdmins({
      type: 'SYSTEM',
      soundType: 'notification',
      title_en: 'New Customer Registered',
      title_mr: 'नवीन ग्राहक नोंदणी',
      title_hi: 'नया ग्राहक पंजीकरण',
      message_en: `Customer ${full_name} (${email}) has registered on the platform.`,
      message_mr: `ग्राहक ${full_name} (${email}) नोंदणीकृत झाला आहे.`,
      message_hi: `ग्राहक ${full_name} (${email}) पंजीकृत हुआ है।`,
      link: '/admin/customers'
    });

    // 4. Initial Points (Welcome bonus: 10 points)
    db.prepare(`
      INSERT INTO customer_points_ledger (id, customer_id, points_change, reason, balance_after)
      VALUES (?, ?, 10, 'Welcome Registration Bonus Points', 10)
    `).run(uuidv4(), customerProfileId);

    // 5. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id)
      VALUES (?, ?, 'CUSTOMER_REGISTERED', 'USER', ?)
    `).run(uuidv4(), userId, userId);
  });

  txn();

  const token = jwt.sign(
    { id: userId, email: email.toLowerCase().trim(), role: 'CUSTOMER' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const profile = db.prepare(`SELECT * FROM customer_profiles WHERE id = ?`).get(customerProfileId);

  return res.status(201).json({
    success: true,
    message: 'Customer registration completed successfully!',
    token,
    user: {
      id: userId,
      email: email.toLowerCase().trim(),
      role: 'CUSTOMER',
      preferred_language
    },
    profile
  });
});

/**
 * POST /api/auth/register/provider
 * Multi-step provider registration with KYC + Bank + Optional FSSAI. Immediate active status (NO KYC approval queue).
 */
router.post('/register/provider', async (req, res) => {
  const {
    provider_name,
    email,
    password,
    mobile,
    kitchen_name,
    kitchen_address,
    food_type = 'Veg',
    experience_years = 2,
    bio = '',
    // Bank Details
    account_holder,
    account_number,
    bank_name,
    ifsc_code,
    // KYC Details
    aadhaar_number,
    pan_number,
    kitchen_proof_url = '/uploads/sample_kitchen.jpg',
    self_declaration_accepted,
    // Optional FSSAI
    has_fssai = false,
    fssai_number = '',
    preferred_language = 'en',
    otp
  } = req.body;

  if (!provider_name || !email || !password || !mobile || !kitchen_name || !kitchen_address) {
    return res.status(400).json({ error: 'Core provider information is required.' });
  }

  if (!account_holder || !account_number || !ifsc_code) {
    return res.status(400).json({ error: 'Complete bank details and IFSC code are required.' });
  }

  // IFSC validation: 4 letters, 0, 6 alphanumeric (e.g. SBIN0001234)
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
  if (!ifscRegex.test(ifsc_code.trim())) {
    return res.status(400).json({ error: 'Invalid IFSC code format (Example: SBIN0001234).' });
  }

  if (!self_declaration_accepted) {
    return res.status(400).json({ error: 'You must accept the KYC self-declaration terms to register.' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'Email already registered. Please log in.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const providerId = uuidv4();

  // Mask sensitive financial and KYC info
  const maskedAccNum = account_number.length > 4 ? `XXXX-XXXX-${account_number.slice(-4)}` : account_number;
  const maskedAadhaar = aadhaar_number ? (aadhaar_number.length > 4 ? `XXXX-XXXX-${aadhaar_number.slice(-4)}` : aadhaar_number) : 'XXXX-XXXX-9876';
  const maskedPan = pan_number ? (pan_number.length > 4 ? `XXXXX${pan_number.slice(-4)}` : pan_number) : 'XXXXX1234F';

  const txn = db.transaction(() => {
    // 1. User Record
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, preferred_language)
      VALUES (?, ?, ?, 'PROVIDER', ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash, preferred_language);

    // 2. Provider Profile (Active immediately with 0.0 initial rating)
    db.prepare(`
      INSERT INTO provider_profiles (id, user_id, provider_name, mobile, kitchen_name, kitchen_address, food_type, experience_years, is_open, bio, rating_avg, total_reviews)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0.0, 0)
    `).run(providerId, userId, provider_name, mobile, kitchen_name, kitchen_address, food_type, parseInt(experience_years) || 1, bio);

    // 3. Bank Details
    db.prepare(`
      INSERT INTO provider_bank_accounts (id, provider_id, account_holder, account_number_masked, bank_name, ifsc_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), providerId, account_holder, maskedAccNum, bank_name || 'Bank of India', ifsc_code.toUpperCase().trim());

    // 4. KYC Record (Self-declaration accepted, NO manual admin approval)
    db.prepare(`
      INSERT INTO provider_kyc_records (id, provider_id, aadhaar_masked, pan_masked, kitchen_proof_url, self_declaration_accepted)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(uuidv4(), providerId, maskedAadhaar, maskedPan, kitchen_proof_url);

    // 5. Optional FSSAI Details
    db.prepare(`
      INSERT INTO provider_fssai_details (id, provider_id, has_fssai, fssai_number)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), providerId, has_fssai ? 1 : 0, has_fssai ? fssai_number : null);

    // 6. Default Pricing
    db.prepare(`
      INSERT INTO provider_pricing (id, provider_id, single_meal_lunch_price, single_meal_dinner_price, weekly_lunch_sub_price, weekly_both_sub_price, monthly_lunch_sub_price, monthly_both_sub_price, extra_roti_unit_price)
      VALUES (?, ?, 110.00, 110.00, 720.00, 1380.00, 2900.00, 5600.00, 10.00)
    `).run(uuidv4(), providerId);

    // 7. Seed Initial Menu Dishes for the Provider (Individual Specific Food Items)
    const today = new Date().toISOString().split('T')[0];
    const lunchItems = [
      { name: 'Dal Fry', desc: 'Homestyle yellow dal fry tempered with cumin, garlic, and pure ghee.', price: 90, spec: 1, prep: 25 },
      { name: 'Matar Paneer', desc: 'Soft cottage cheese cubes and green peas in spiced tomato curry.', price: 110, spec: 1, prep: 20 },
      { name: 'Phulka Roti', desc: 'Fresh soft whole wheat phulkas.', price: 10, spec: 0, prep: 30 },
      { name: 'Steamed Rice', desc: 'Aromatic long grain steamed basmati rice.', price: 80, spec: 0, prep: 25 }
    ];
    for (const item of lunchItems) {
      db.prepare(`
        INSERT INTO menu_items (id, provider_id, meal_type, name, description, price, is_speciality, is_available, prep_count, menu_date)
        VALUES (?, ?, 'LUNCH', ?, ?, ?, ?, 1, ?, ?)
      `).run(uuidv4(), providerId, item.name, item.desc, item.price, item.spec, item.prep, today);
    }

    const dinnerItems = [
      { name: 'Sev Tamatar', desc: 'Kathiyawadi style sev in rich tangy tomato gravy.', price: 100, spec: 1, prep: 18 },
      { name: 'Mix Veg', desc: 'Seasonal vegetable medley tossed in homestyle spices.', price: 100, spec: 0, prep: 15 },
      { name: 'Dal Tadka', desc: 'Garlic tempered yellow lentils.', price: 90, spec: 0, prep: 20 }
    ];
    for (const item of dinnerItems) {
      db.prepare(`
        INSERT INTO menu_items (id, provider_id, meal_type, name, description, price, is_speciality, is_available, prep_count, menu_date)
        VALUES (?, ?, 'DINNER', ?, ?, ?, ?, 1, ?, ?)
      `).run(uuidv4(), providerId, item.name, item.desc, item.price, item.spec, item.prep, today);
    }

    // 8. Welcome Notification
    NotificationEngine.sendNotification({
      userId,
      type: 'SYSTEM',
      soundType: 'notification',
      title_en: 'Kitchen Active & Live! 👨‍🍳',
      title_mr: 'स्वयंपाकघर सक्रिय झाले! 👨‍🍳',
      title_hi: 'रसोई सक्रिय और लाइव! 👨‍🍳',
      message_en: `Welcome ${kitchen_name}! Your kitchen is now open and active on Aapna Tiffin. Set your daily menu and start receiving orders.`,
      message_mr: `आपले स्वागत आहे ${kitchen_name}! आपले स्वयंपाकघर आता सुरू झाले आहे. आजचा मेनू सेट करा आणि ऑर्डर्स मिळवा.`,
      message_hi: `स्वागत है ${kitchen_name}! आपकी रसोई अब सक्रिय है। आज का मेनू सेट करें और ऑर्डर प्राप्त करना शुरू करें।`,
      link: '/provider'
    });

    // Admin Notification
    NotificationEngine.notifyAdmins({
      type: 'SYSTEM',
      soundType: 'notification',
      title_en: 'New Kitchen Registered',
      title_mr: 'नवीन स्वयंपाकघर नोंदणी',
      title_hi: 'नई रसोई पंजीकरण',
      message_en: `New provider registered: ${provider_name} (${kitchen_name}, ${food_type}).`,
      message_mr: `नवीन प्रदाता नोंदणी: ${provider_name} (${kitchen_name}).`,
      message_hi: `नया प्रदाता पंजीकरण: ${provider_name} (${kitchen_name})।`,
      link: '/admin/providers'
    });

    // 9. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id)
      VALUES (?, ?, 'PROVIDER_REGISTERED_AND_ACTIVATED', 'PROVIDER', ?)
    `).run(uuidv4(), userId, providerId);
  });

  txn();

  const token = jwt.sign(
    { id: userId, email: email.toLowerCase().trim(), role: 'PROVIDER' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const profile = db.prepare(`SELECT * FROM provider_profiles WHERE id = ?`).get(providerId);

  return res.status(201).json({
    success: true,
    message: 'Provider registered and activated successfully!',
    token,
    user: {
      id: userId,
      email: email.toLowerCase().trim(),
      role: 'PROVIDER',
      preferred_language
    },
    profile
  });
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateJWT, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      preferred_language: req.user.preferred_language
    },
    profile: req.user.profile
  });
});

/**
 * PUT /api/auth/language
 */
router.put('/language', authenticateJWT, (req, res) => {
  const { language } = req.body;
  if (!['en', 'mr', 'hi'].includes(language)) {
    return res.status(400).json({ error: 'Language must be one of: en, mr, hi' });
  }

  db.prepare(`UPDATE users SET preferred_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(language, req.user.id);

  return res.json({
    success: true,
    message: 'Language updated successfully.',
    preferred_language: language
  });
});

module.exports = router;
