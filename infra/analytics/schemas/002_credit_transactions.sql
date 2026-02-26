-- CREDIT TRANSACTIONS SCHEMA
-- Atomic, immutable transaction log for credit balance
-- Balance = SUM(credits_delta) for user_id

CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL, -- UUID v4 for idempotency
    user_id TEXT NOT NULL,
    
    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'PURCHASE',      -- User bought credits
        'CONSUMPTION',   -- Credits spent on content
        'REFUND',        -- Refund issued
        'ADMIN_ADD',     -- Manual credit grant
        'ADMIN_REMOVE',  -- Manual credit deduction
        'BONUS',         -- Engagement reward
        'PROMO'          -- Promotional credits
    )),
    
    -- Amount (always positive - direction determined by sign in calculation)
    -- For consumption: negative when applied
    credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
    
    -- Running balance snapshot (for audit/debugging)
    balance_after INTEGER NOT NULL,
    
    -- Context
    story_id TEXT,           -- For CONSUMPTION: which story
    chapter_id TEXT,         -- For CONSUMPTION: which chapter
    message_id TEXT,         -- For CONSUMPTION: which message revealed
    purchase_id TEXT,        -- For PURCHASE: reference to transaction
    admin_user_id TEXT,      -- For ADMIN_*: who authorized
    reason TEXT,             -- Human-readable explanation
    
    -- Idempotency/Deduplication
    idempotency_key TEXT,    -- Client-generated for retries
    
    -- Financial (for PURCHASE types)
    currency TEXT,
    amount_paid DECIMAL(10,2), -- Store price paid
    
    -- Metadata
    metadata JSON,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_credit_transactions_user_id (user_id),
    INDEX idx_credit_transactions_transaction_id (transaction_id),
    INDEX idx_credit_transactions_created_at (created_at),
    INDEX idx_credit_transactions_user_created (user_id, created_at),
    INDEX idx_credit_transactions_idempotency (idempotency_key),
    INDEX idx_credit_transactions_purchase_id (purchase_id),
    INDEX idx_credit_transactions_transaction_type (transaction_type)
);

-- Transaction locks table (soft-locking for double-spend prevention)
-- In distributed systems, use Redis/D1 INSERT with UNIQUE constraint
-- Here we use idempotency_key pattern

CREATE TABLE IF NOT EXISTS transaction_locks (
    lock_key TEXT PRIMARY KEY, -- "user:{user_id}:lock:{action}:{entity_id}"
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,     -- 'consume', 'purchase', etc.
    entity_id TEXT,           -- message_id or purchase_id
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,      -- Auto-expire locks
    transaction_id TEXT,      -- References credit_transactions
    
    INDEX idx_transaction_locks_user_id (user_id),
    INDEX idx_transaction_locks_expires (expires_at)
);

-- Cleanup old locks periodically
-- DELETE FROM transaction_locks WHERE expires_at < datetime('now');

-- Balance view (efficient calculation)
-- Note: In production, cache this in Redis or compute on write
CREATE VIEW IF NOT EXISTS user_balances AS
SELECT 
    user_id,
    SUM(CASE 
        WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') 
        THEN credits_amount 
        ELSE -credits_amount 
    END) as credit_balance,
    COUNT(*) as transaction_count,
    MAX(created_at) as last_transaction_at
FROM credit_transactions
GROUP BY user_id;

-- Daily aggregated view for financial reporting
CREATE VIEW IF NOT EXISTS daily_credit_summary AS
SELECT 
    DATE(created_at) as date,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(credits_amount) as total_credits,
    SUM(CASE WHEN currency IS NOT NULL THEN amount_paid ELSE 0 END) as total_revenue,
    currency
FROM credit_transactions
GROUP BY DATE(created_at), transaction_type, currency;
