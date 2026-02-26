-- Seed data for StoryChat
-- Creates demo users with proper credit balances

-- Sample user: user@demo.com / password: demo123
INSERT INTO users (id, email, display_name, auth_provider, password_hash, subscription_tier, is_admin, created_at, last_login_at)
VALUES (
  'demo_user_001',
  'user@demo.com',
  'Demo User',
  'email',
  '${HASH}', -- Will be hashed with PBKDF2
  'free',
  FALSE,
  datetime('now'),
  datetime('now')
);

-- Admin user: admin@demo.com / password: admin123
INSERT INTO users (id, email, display_name, auth_provider, password_hash, subscription_tier, is_admin, created_at, last_login_at)
VALUES (
  'admin_user_001',
  'admin@demo.com',
  'Admin User',
  'email',
  '${ADMIN_HASH}',
  'premium',
  TRUE,
  datetime('now'),
  datetime('now')
);

-- Another demo user with Google OAuth
INSERT INTO users (id, email, display_name, auth_provider, auth_provider_id, subscription_tier, is_admin, created_at, last_login_at)
VALUES (
  'demo_user_002',
  'google@demo.com',
  'Google User',
  'google',
  'google_123456',
  'free',
  FALSE,
  datetime('now'),
  datetime('now')
);

-- Credit transactions for demo user (50 starting credits)
INSERT INTO credit_transactions (transaction_id, user_id, transaction_type, credits_amount, balance_after, idempotency_key, reason, created_at)
VALUES 
  ('tx_welcome_001', 'demo_user_001', 'BONUS', 50, 50, 'welcome_demo_user_001', 'Welcome bonus', datetime('now')),
  ('tx_welcome_002', 'demo_user_002', 'BONUS', 50, 50, 'welcome_demo_user_002', 'Welcome bonus', datetime('now')),
  ('tx_admin_welcome', 'admin_user_001', 'BONUS', 200, 200, 'welcome_admin_user_001', 'Admin bonus', datetime('now'));
