-- GROWTH LOOPS SCHEMA
-- Configuration and tracking for growth mechanisms

-- Credit gate configuration per story/chapter
CREATE TABLE IF NOT EXISTS credit_gates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    
    -- Gate position
    messages_free INTEGER DEFAULT 3,       -- Messages before first gate
    messages_per_credit INTEGER DEFAULT 1, -- Messages per credit spent
    
    -- Gate behavior
    gate_type TEXT DEFAULT 'dynamic' CHECK (gate_type IN ('none', 'static', 'dynamic', 'progressive')),
    -- 'none' - no gate, story is free
    -- 'static' - fixed number of messages free
    -- 'dynamic' - first chapter free, gates vary by engagement
    -- 'progressive' - more credits needed for later chapters
    
    -- Progressive pricing (for gate_type='progressive')
    chapter_credits INTEGER DEFAULT 1,     -- Credits per chapter unlock
    multiplier REAL DEFAULT 1.0,           -- Multiplier for chapter N
    
    -- Engagement triggers
    bonus_credits_delay INTEGER,         -- Award credits if user waits X seconds
    bonus_credits_amount INTEGER DEFAULT 1,-- Credits awarded for waiting
    
    -- A/B test variant
    variant TEXT DEFAULT 'control',
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(story_id, chapter_id, variant),
    INDEX idx_credit_gates_story (story_id)
);

-- Share webhooks configuration
CREATE TABLE IF NOT EXISTS share_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT UNIQUE NOT NULL,
    
    -- Target configuration
    name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    secret TEXT,                         -- For HMAC signature
    
    -- Trigger events
    trigger_event TEXT CHECK (trigger_event IN (
        'story_completed',
        'chapter_completed',
        'milestone_achieved',
        'purchase_completed'
    )),
    
    -- Payload template (JSON with placeholders)
    payload_template JSON,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    last_triggered_at DATETIME,
    failure_count INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_webhooks_event (trigger_event),
    INDEX idx_webhooks_active (active)
);

-- Share completions log (success/failure tracking)
CREATE TABLE IF NOT EXISTS share_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    chapter_id TEXT,
    
    -- Completion type
    completion_type TEXT NOT NULL,       -- 'milestone', 'chapter', 'story'
    
    -- Share result
    webhook_id TEXT,
    triggered_at DATETIME,
    response_status INTEGER,           -- HTTP status
    response_body TEXT,                  -- Response for debugging
    success BOOLEAN,
    
    -- User-initiated share
    platform_shared_to TEXT,             -- 'twitter', 'facebook', 'copy', etc.
    share_initiated_by_user BOOLEAN DEFAULT FALSE,
    
    -- Attribution
    utm_source TEXT,
    utm_medium TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_shares_user_id (user_id),
    INDEX idx_shares_story_id (story_id),
    INDEX idx_shares_type (completion_type)
);

-- First chapter seed data (ensuring every story has at least one free chapter)
INSERT OR IGNORE INTO credit_gates (story_id, chapter_id, messages_free, gate_type, chapter_credits)
SELECT 'default_all', 'chapter_1', 9999, 'none', 0
WHERE NOT EXISTS (SELECT 1 FROM credit_gates WHERE chapter_id = 'chapter_1');

-- Growth loop effectiveness tracking
CREATE VIEW IF NOT EXISTS growth_loop_metrics AS
SELECT 
    DATE(cg.story_id) as analysis_date,
    cg.variant,
    cg.gate_type,
    COUNT(DISTINCT sf.user_id) as users_entered,
    COUNT(DISTINCT CASE WHEN sf.credits_spent > 0 THEN sf.user_id END) as users_converted,
    COUNT(DISTINCT CASE WHEN sf.completed_at IS NOT NULL THEN sf.user_id END) as users_completed,
    AVG(sf.credits_spent) as avg_credits_spent,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN sf.credits_spent > 0 THEN sf.user_id END) / 
          NULLIF(COUNT(DISTINCT sf.user_id), 0), 2) as gate_conversion_rate,
    COUNT(sc.id) as social_shares,
    ROUND(SUM(ct.amount_paid), 2) as attributed_revenue
FROM credit_gates cg
LEFT JOIN story_funnels sf ON cg.story_id = sf.story_id AND cg.chapter_id = sf.chapter_id
LEFT JOIN share_completions sc ON sf.story_id = sc.story_id AND sf.user_id = sc.user_id
LEFT JOIN credit_transactions ct ON sf.user_id = ct.user_id AND ct.transaction_type = 'PURCHASE'
    AND ct.created_at BETWEEN sf.started_at AND datetime(sf.started_at, '+7 days')
GROUP BY cg.variant, cg.gate_type;
