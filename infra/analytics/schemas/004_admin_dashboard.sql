-- ADMIN DASHBOARD SCHEMA
-- Optimized tables and views for admin analytics queries

-- Daily active users snapshot (append-only, partition by date)
CREATE TABLE IF NOT EXISTS daily_active_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    
    -- DAU metrics
    dau INTEGER NOT NULL,              -- Unique users with session
    mau INTEGER NOT NULL,              -- Monthly active (rolling 30d)
    wau INTEGER NOT NULL,              -- Weekly active (rolling 7d)
    
    -- New vs Returning
    new_users INTEGER DEFAULT 0,       -- First session today
    returning_users INTEGER DEFAULT 0, -- Previous session exists
    
    -- Engagement depth
    avg_session_duration REAL,         -- Average session length
    total_sessions INTEGER,
    
    -- Story metrics
    stories_started INTEGER,
    chapters_completed INTEGER,
    
    -- Credit metrics
    credits_issued INTEGER,
    credits_consumed INTEGER,
    credit_revenue REAL,               -- credits_consumed * $0.01
    
    -- Purchase metrics
    new_purchases INTEGER,
    total_purchase_revenue REAL,
    
    -- Create unique constraint
    UNIQUE(date),
    
    INDEX idx_dau_date (date)
);

-- Real-time or near-real-time credit revenue tracking
CREATE VIEW IF NOT EXISTS credit_revenue_realtime AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as transactions,
    SUM(CASE WHEN created_at >= datetime('now', '-1 hour') 
        AND transaction_type = 'CONSUMPTION' 
        THEN credits_amount ELSE 0 END) as credits_last_hour,
    SUM(CASE WHEN transaction_type = 'CONSUMPTION' 
        THEN credits_amount ELSE 0 END) as credits_today,
    ROUND(SUM(CASE WHEN transaction_type = 'CONSUMPTION' 
        THEN credits_amount ELSE 0 END) * 0.01, 2) as revenue_today_usd
FROM credit_transactions
WHERE DATE(created_at) = DATE('now')
GROUP BY DATE(created_at);

-- Top stories by engagement (materialized view pattern)
CREATE TABLE IF NOT EXISTS top_stories_dashboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Engagement
    unique_readers INTEGER DEFAULT 0,
    total_starts INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    completion_rate REAL DEFAULT 0,
    
    -- Time
    avg_time_to_complete REAL DEFAULT 0,
    total_engagement_minutes INTEGER DEFAULT 0,
    
    -- Monetization
    total_credits_consumed INTEGER DEFAULT 0,
    estimated_revenue REAL DEFAULT 0,
    
    -- Retention proxy
    return_rate REAL DEFAULT 0, -- % who read another chapter
    
    -- Rankings
    engagement_rank INTEGER,
    revenue_rank INTEGER,
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(story_id, period_start, period_end),
    INDEX idx_top_stories_period (period_start, period_end)
);

-- Churn prediction table (users flagged at risk)
CREATE TABLE IF NOT EXISTS churn_prediction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    
    -- Risk factors
    current_credits INTEGER DEFAULT 0,
    last_engagement_at DATETIME,
    days_since_engagement INTEGER DEFAULT 0,
    total_stories_completed INTEGER DEFAULT 0,
    
    -- Risk score (0-100)
    churn_risk_score INTEGER DEFAULT 0,
    risk_bucket TEXT CHECK (risk_bucket IN ('low', 'medium', 'high', 'critical')),
    
    -- Actions
    notified BOOLEAN DEFAULT FALSE,    -- Sent re-engagement push?
    notification_sent_at DATETIME,
    
    -- Model metadata
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_churn_risk_score (churn_risk_score),
    INDEX idx_churn_risk_bucket (risk_bucket),
    INDEX idx_churn_calculated_at (calculated_at)
);

-- Churn calculation view (to be scheduled daily)
CREATE VIEW IF NOT EXISTS churn_risk_users AS
SELECT 
    user_id,
    current_credits,
    days_since_engagement,
    total_stories_completed,
    churn_risk_score,
    CASE 
        WHEN churn_risk_score >= 70 THEN 'critical'
        WHEN churn_risk_score >= 50 THEN 'high'
        WHEN churn_risk_score >= 30 THEN 'medium'
        ELSE 'low'
    END as risk_bucket,
    notified,
    calculated_at
FROM churn_prediction
WHERE churn_risk_score >= 30
ORDER BY churn_risk_score DESC;

-- Admin dashboard quick stats view
CREATE VIEW IF NOT EXISTS dashboard_quick_stats AS
SELECT 
    (SELECT dau FROM daily_active_users ORDER BY date DESC LIMIT 1) as current_dau,
    (SELECT credit_revenue FROM daily_active_users ORDER BY date DESC LIMIT 1) as today_revenue,
    (SELECT SUM(credits_spent) * 0.01 FROM story_funnels WHERE DATE(created_at) = DATE('now')) as realtime_ltv_today,
    (SELECT COUNT(*) FROM churn_prediction WHERE churn_risk_score >= 50 AND notified = FALSE) as high_risk_users_pending,
    (SELECT COUNT(*) FROM top_stories_dashboard WHERE DATE(period_end) = DATE('now')) as stories_ranked_today,
    (SELECT COUNT(*) FROM credit_transactions WHERE created_at >= datetime('now', '-1 hour')) as transactions_last_hour;
