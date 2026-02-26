-- ENGAGEMENT METRICS SCHEMA
-- Pre-aggregated tables and materialized views for funnel analysis

-- Story completion funnel tracking
CREATE TABLE IF NOT EXISTS story_funnels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    
    -- Funnel stages
    started_at DATETIME,
    first_message_at DATETIME,
    last_message_at DATETIME,
    completed_at DATETIME,
    
    -- Progress tracking
    total_messages INTEGER DEFAULT 0,
    messages_consumed INTEGER DEFAULT 0,
    photos_viewed INTEGER DEFAULT 0,
    
    -- Time metrics (in seconds)
    time_to_first_message INTEGER, -- time from start to first reveal
    time_to_completion INTEGER,    -- time from start to finish
    total_engagement_time INTEGER, -- active time in session
    
    -- Credit consumption
    credits_spent INTEGER DEFAULT 0,
    
    -- Drop-off tracking
    last_message_id TEXT,          -- Where user stopped
    drop_off_reason TEXT,          -- 'credit_gate', 'app_close', 'complete', etc.
    
    -- Session info
    session_id TEXT,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, story_id, chapter_id),
    INDEX idx_funnels_user_id (user_id),
    INDEX idx_funnels_story_id (story_id),
    INDEX idx_funnels_drop_off (drop_off_reason),
    INDEX idx_funnels_created_at (created_at)
);

-- Message-level drop-off tracking
CREATE TABLE IF NOT EXISTS message_engagement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    
    -- Aggregate metrics
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    credit_reveals INTEGER DEFAULT 0,
    drop_offs INTEGER DEFAULT 0,   -- Users who stopped here
    
    -- Timing
    avg_time_to_reveal REAL,       -- Seconds from chapter start to seeing this message
    
    -- Updated via periodic aggregation
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(story_id, chapter_id, message_id),
    INDEX idx_msg_engagement_chapter (chapter_id)
);

-- Push notification effectiveness
CREATE TABLE IF NOT EXISTS notification_effectiveness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT NOT NULL,
    notification_type TEXT NOT NULL, -- 'new_chapter', 'story_complete', 'credit_low', 're_engagement'
    
    -- Targeting
    user_id TEXT NOT NULL,
    story_id TEXT,
    
    -- Events
    sent_at DATETIME,
    delivered_at DATETIME,
    opened_at DATETIME,
    dismissed_at DATETIME,
    
    -- Conversion (within 1 hour)
    converted_at DATETIME,
    conversion_action TEXT,        -- 'story_open', 'purchase', etc.
    
    -- Metadata
    platform TEXT,
    
    INDEX idx_notif_user_id (user_id),
    INDEX idx_notif_type (notification_type),
    INDEX idx_notif_sent_at (sent_at),
    INDEX idx_notif_converted (converted_at)
);

-- Drop-off analysis view
CREATE VIEW IF NOT EXISTS drop_off_analysis AS
SELECT 
    story_id,
    chapter_id,
    drop_off_reason,
    COUNT(*) as user_count,
    AVG(credits_spent) as avg_credits_spent,
    AVG(messages_consumed) as avg_messages_seen,
    AVG(time_to_completion) as avg_time_before_exit
FROM story_funnels
WHERE drop_off_reason IS NOT NULL
GROUP BY story_id, chapter_id, drop_off_reason;

-- Chapter completion rate view
CREATE VIEW IF NOT EXISTS chapter_completion_rates AS
SELECT 
    story_id,
    chapter_id,
    COUNT(*) as total_starts,
    COUNT(completed_at) as completions,
    ROUND(100.0 * COUNT(completed_at) / COUNT(*), 2) as completion_rate_pct,
    AVG(time_to_completion) as avg_seconds_to_complete
FROM story_funnels
GROUP BY story_id, chapter_id;

-- LTV proxy (Credits per user)
CREATE VIEW IF NOT EXISTS user_ltv_metrics AS
SELECT 
    user_id,
    COUNT(DISTINCT story_id) as stories_started,
    SUM(credits_spent) as total_credits_spent,
    ROUND(SUM(credits_spent) * 0.01, 2) as estimated_ltv_usd,
    AVG(credits_spent) as avg_credits_per_story,
    MAX(created_at) as last_engagement,
    DATE(MIN(created_at)) as first_seen
FROM story_funnels
GROUP BY user_id;
