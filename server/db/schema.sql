-- =========================================================================
-- AAPNA TIFFIN - COMPLETE RELATIONAL DATABASE SCHEMA (SQLITE)
-- Production-Ready Marketplace Database Model with Transactions & Audit Trail
-- =========================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- 1. USERS & CORE AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'PROVIDER', 'ADMIN')),
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'mr', 'hi')),
    is_blocked INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. CUSTOMER PROFILES
CREATE TABLE IF NOT EXISTS customer_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROVIDER PROFILES (No manual KYC approval state; active upon registration)
CREATE TABLE IF NOT EXISTS provider_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    kitchen_name TEXT NOT NULL,
    kitchen_address TEXT NOT NULL,
    food_type TEXT NOT NULL DEFAULT 'Veg', -- 'Veg', 'Non-Veg', 'Both', 'Jain Available'
    experience_years INTEGER NOT NULL DEFAULT 1,
    is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
    bio TEXT,
    rating_avg REAL NOT NULL DEFAULT 0.0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_is_open ON provider_profiles(is_open);

-- 4. PROVIDER BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS provider_bank_accounts (
    id TEXT PRIMARY KEY,
    provider_id TEXT UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    account_holder TEXT NOT NULL,
    account_number_masked TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. PROVIDER KYC RECORDS (Completed during registration; self-declaration accepted)
CREATE TABLE IF NOT EXISTS provider_kyc_records (
    id TEXT PRIMARY KEY,
    provider_id TEXT UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    aadhaar_masked TEXT NOT NULL,
    pan_masked TEXT NOT NULL,
    kitchen_proof_url TEXT,
    self_declaration_accepted INTEGER NOT NULL DEFAULT 1 CHECK (self_declaration_accepted = 1),
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. PROVIDER FSSAI DETAILS (Optional)
CREATE TABLE IF NOT EXISTS provider_fssai_details (
    id TEXT PRIMARY KEY,
    provider_id TEXT UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    has_fssai INTEGER NOT NULL DEFAULT 0 CHECK (has_fssai IN (0, 1)),
    fssai_number TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. PROVIDER PRICING & AUTO-PRICING
CREATE TABLE IF NOT EXISTS provider_pricing (
    id TEXT PRIMARY KEY,
    provider_id TEXT UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    single_meal_lunch_price REAL NOT NULL DEFAULT 110.00,
    single_meal_dinner_price REAL NOT NULL DEFAULT 110.00,
    weekly_lunch_sub_price REAL NOT NULL DEFAULT 720.00,
    weekly_both_sub_price REAL NOT NULL DEFAULT 1380.00,
    monthly_lunch_sub_price REAL NOT NULL DEFAULT 2900.00,
    monthly_both_sub_price REAL NOT NULL DEFAULT 5600.00,
    extra_roti_unit_price REAL NOT NULL DEFAULT 10.00,
    auto_pricing_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_pricing_enabled IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. MENU ITEMS (Lunch & Dinner dishes for today & menu history)
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('LUNCH', 'DINNER')),
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    photo_url TEXT,
    is_speciality INTEGER NOT NULL DEFAULT 0 CHECK (is_speciality IN (0, 1)),
    is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
    prep_count INTEGER NOT NULL DEFAULT 0, -- Food preparation frequency counter
    menu_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_provider_date ON menu_items(provider_id, menu_date);

-- 9. ORDERS & DELIVERY OTP
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    meal_type TEXT NOT NULL CHECK (meal_type IN ('LUNCH', 'DINNER', 'BOTH')),
    plan_type TEXT NOT NULL CHECK (plan_type IN ('SINGLE', 'WEEKLY', 'MONTHLY')),
    num_meals INTEGER NOT NULL DEFAULT 1,
    extra_roti_count INTEGER NOT NULL DEFAULT 0,
    base_amount REAL NOT NULL,
    extra_roti_amount REAL NOT NULL DEFAULT 0.00,
    charges_amount REAL NOT NULL DEFAULT 0.00,
    discount_amount REAL NOT NULL DEFAULT 0.00,
    final_amount REAL NOT NULL,
    order_status TEXT NOT NULL DEFAULT 'NEW' CHECK (order_status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED')),
    payment_status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (payment_status IN ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    delivery_otp TEXT NOT NULL, -- 4-digit numeric OTP
    delivery_otp_attempts INTEGER NOT NULL DEFAULT 0,
    otp_verified_at DATETIME,
    delivery_proof_url TEXT, -- Uploaded when customer is unavailable
    delivery_scheduled_time DATETIME NOT NULL,
    special_instructions TEXT,
    cancelled_by TEXT CHECK (cancelled_by IN ('CUSTOMER', 'PROVIDER', 'ADMIN', NULL)),
    cancellation_reason TEXT,
    cancellation_time DATETIME,
    deduction_amount REAL NOT NULL DEFAULT 0.00,
    refund_amount REAL NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

-- 10. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id TEXT REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL
);

-- 11. SUBSCRIPTIONS & MEAL USAGE TRACKING
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    order_id TEXT NOT NULL REFERENCES orders(id),
    plan_type TEXT NOT NULL CHECK (plan_type IN ('WEEKLY', 'MONTHLY')),
    meal_type TEXT NOT NULL CHECK (meal_type IN ('LUNCH', 'DINNER', 'BOTH')),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    total_lunch INTEGER NOT NULL DEFAULT 0,
    used_lunch INTEGER NOT NULL DEFAULT 0,
    total_dinner INTEGER NOT NULL DEFAULT 0,
    used_dinner INTEGER NOT NULL DEFAULT 0,
    extra_roti_per_meal INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'COMPLETED')),
    paused_until DATE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_provider ON subscriptions(provider_id);

-- 11B. SUBSCRIPTION MEALS (Date-specific meals and calendar tracking)
CREATE TABLE IF NOT EXISTS subscription_meals (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('LUNCH', 'DINNER')),
    order_id TEXT REFERENCES orders(id),
    menu_snapshot TEXT, -- JSON snapshot of dishes scheduled/served on that day
    extra_roti_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'DELIVERED', 'PREPARING', 'READY', 'EN_ROUTE', 'CANCELLED', 'SKIPPED', 'PENDING')),
    cancellation_status TEXT DEFAULT NULL CHECK (cancellation_status IN (NULL, 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_PROVIDER')),
    cancellation_reason TEXT,
    cancellation_time DATETIME,
    refund_amount REAL NOT NULL DEFAULT 0.00,
    delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED')),
    delivery_time DATETIME,
    delivery_otp TEXT,
    delivery_proof_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, meal_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_sub_meals_date ON subscription_meals(subscription_id, meal_date);

-- 12. BILLS (Immutable itemized records for Customer and Provider)
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    bill_number TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    bill_type TEXT NOT NULL CHECK (bill_type IN ('CUSTOMER', 'PROVIDER')),
    plan_meal_name TEXT NOT NULL,
    meal_slot TEXT NOT NULL, -- Lunch / Dinner / Both
    extra_roti_count INTEGER NOT NULL DEFAULT 0,
    base_amount REAL NOT NULL,
    charges REAL NOT NULL DEFAULT 0.00,
    discount REAL NOT NULL DEFAULT 0.00,
    cancellation_deduction REAL NOT NULL DEFAULT 0.00,
    refund_amount REAL NOT NULL DEFAULT 0.00,
    gross_amount REAL NOT NULL,
    platform_commission REAL NOT NULL DEFAULT 0.00,
    provider_penalty REAL NOT NULL DEFAULT 0.00,
    final_payable REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    gateway TEXT NOT NULL DEFAULT 'Razorpay Mock',
    transaction_id TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'SUCCESS',
    refund_status TEXT NOT NULL DEFAULT 'NONE', -- 'NONE', 'PARTIAL', 'FULL'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_provider ON bills(provider_id);
CREATE INDEX IF NOT EXISTS idx_bills_order ON bills(order_id);

-- 13. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    gateway TEXT NOT NULL DEFAULT 'Razorpay Mock',
    gateway_txn_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. PROVIDER SETTLEMENTS & PAYOUTS
CREATE TABLE IF NOT EXISTS provider_payouts (
    id TEXT PRIMARY KEY,
    payout_number TEXT UNIQUE NOT NULL,
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    gross_earnings REAL NOT NULL,
    commission_deducted REAL NOT NULL,
    penalties_deducted REAL NOT NULL DEFAULT 0.00,
    refund_adjustments REAL NOT NULL DEFAULT 0.00,
    net_payout REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    transaction_ref TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. PENALTY LEDGER (Provider penalties & penalty points)
CREATE TABLE IF NOT EXISTS penalty_ledger (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    order_id TEXT REFERENCES orders(id),
    penalty_points INTEGER NOT NULL DEFAULT 0,
    penalty_amount REAL NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    balance_points_after INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. CUSTOMER POINTS LEDGER
CREATE TABLE IF NOT EXISTS customer_points_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    order_id TEXT REFERENCES orders(id),
    points_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. CUSTOMER MILESTONE REWARDS (100 Points -> 1 Free 1-Day Meal with duplicate prevention)
CREATE TABLE IF NOT EXISTS customer_rewards (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    milestone_points INTEGER NOT NULL, -- 100, 200, 300 etc.
    reward_code TEXT UNIQUE NOT NULL,
    reward_type TEXT NOT NULL DEFAULT 'FREE_1_DAY_MEAL',
    free_meal_value REAL NOT NULL DEFAULT 110.00,
    is_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (is_redeemed IN (0, 1)),
    redeemed_order_id TEXT REFERENCES orders(id),
    provider_reimbursement_amount REAL NOT NULL DEFAULT 110.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    redeemed_at DATETIME,
    UNIQUE(customer_id, milestone_points) -- Idempotency: Prevent duplicate reward for same milestone
);

-- 18. RATINGS & REVIEWS
CREATE TABLE IF NOT EXISTS ratings_reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    points_awarded INTEGER NOT NULL DEFAULT 5,
    is_reported INTEGER NOT NULL DEFAULT 0 CHECK (is_reported IN (0, 1)),
    report_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. CHAT CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id),
    topic TEXT NOT NULL CHECK (topic IN ('Menu', 'Meal', 'Subscription', 'Availability', 'Timing', 'Order', 'Other')),
    custom_subject TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('CUSTOMER', 'PROVIDER')),
    message_text TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. CHAT REPORTS
CREATE TABLE IF NOT EXISTS chat_reports (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id),
    reporter_id TEXT NOT NULL REFERENCES users(id),
    reported_user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    order_id TEXT REFERENCES orders(id),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED', 'CLOSED')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. COMPLAINTS TICKETING
CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    reported_id TEXT REFERENCES users(id),
    order_id TEXT REFERENCES orders(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    resolution_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_en TEXT NOT NULL,
    title_mr TEXT NOT NULL,
    title_hi TEXT NOT NULL,
    message_en TEXT NOT NULL,
    message_mr TEXT NOT NULL,
    message_hi TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ORDER', 'PAYMENT', 'DELIVERY', 'REWARD', 'PENALTY', 'SYSTEM'
    sound_type TEXT DEFAULT 'notification', -- 'notification', 'payment'
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    link TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 23. ADMIN SETTINGS (Platform parameters & configurable business rules)
CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata_json TEXT,
    ip_address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. CUSTOMER LOCATIONS (Device & saved delivery coordinates)
CREATE TABLE IF NOT EXISTS customer_locations (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    area TEXT,
    postal_code TEXT,
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cust_loc_customer ON customer_locations(customer_id);

-- 26. PROVIDER LOCATIONS (Kitchen / origin location)
CREATE TABLE IF NOT EXISTS provider_locations (
    id TEXT PRIMARY KEY,
    provider_id TEXT UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    area TEXT,
    postal_code TEXT,
    is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prov_loc_provider ON provider_locations(provider_id);

-- 27. PROVIDER SERVICE AREAS (Dynamic & date-specific service radius)
CREATE TABLE IF NOT EXISTS provider_service_areas (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    radius_km REAL NOT NULL DEFAULT 5.0,
    effective_date DATE, -- NULL = default radius; if set, date-specific override
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prov_service_areas ON provider_service_areas(provider_id, effective_date);

-- 28. ORDER DELIVERY LOCATIONS (Immutable location snapshot at order creation)
CREATE TABLE IF NOT EXISTS order_delivery_locations (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    area TEXT,
    postal_code TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_deliv_loc ON order_delivery_locations(order_id);

-- 29. DELIVERY ROUTE RECORDS (Persistent provider dispatch routes)
CREATE TABLE IF NOT EXISTS delivery_route_records (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    route_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('LUNCH', 'DINNER', 'ALL')),
    total_distance_km REAL NOT NULL DEFAULT 0.0,
    estimated_duration_mins REAL NOT NULL DEFAULT 0.0,
    waypoints_json TEXT, -- JSON array of [lat, lon] road polyline geometry
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliv_route_prov_date ON delivery_route_records(provider_id, route_date);

-- 30. DELIVERY ROUTE STOPS (Ordered sequence of customer delivery stops)
CREATE TABLE IF NOT EXISTS delivery_route_stops (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES delivery_route_records(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id TEXT NOT NULL REFERENCES customer_profiles(id),
    stop_sequence INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    meal_type TEXT NOT NULL,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED')),
    otp_verified INTEGER NOT NULL DEFAULT 0 CHECK (otp_verified IN (0, 1)),
    photo_proof_url TEXT,
    delivered_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliv_route_stops_route ON delivery_route_stops(route_id, stop_sequence);

