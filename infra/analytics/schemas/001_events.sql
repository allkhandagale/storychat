-- ANALYTICS EVENTS SCHEMA
-- Cloudflare D1 (SQLite) compatible
-- Primary events table for all user interactions

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    story_id TEXT,
    chapter_id TEXT,
    message_id TEXT,
    credits_delta INTEGER DEFAULT 0,
    
    -- JSON metadata for flexible event tracking
    metadata JSON,
    
    -- Device/Context info
    platform TEXT, -- 'ios', 'android', 'web'
    app_version TEXT,
    
    -- Timing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_events_user_id (user_id),
    INDEX idx_events_event_type (event_type),
    INDEX idx_events_timestamp (timestamp),
    INDEX idx_events_user_timestamp (user_id, timestamp),
    INDEX idx_events_story_id (story_id),
    INDEX idx_events_session_id (session_id)
);

-- Event types reference:
-- story_viewed        - User opened story/episode list
-- chapter_started      - User started reading a chapter
-- chapter_completed    - User finished chapter (last message viewed)
-- message_revealed     - User revealed/paid to see a message
-- photo_viewed         - User viewed a photo in chat
-- credit_spent         - Credits consumed (positive amount in credits_delta)
-- credit_added         - Credits purchased or rewarded (positive)
-- purchase_clicked     - User opened purchase flow
-- purchase_completed   - Successful purchase
-- purchase_cancelled   - Abandoned purchase
-- upgrade_prompt_shown - Credit gate/paywall displayed
-- upgrade_accepted     - User chose to buy credits
-- upgrade_skipped      - User dismissed paywall
-- notification_sent    - Push notification delivered
-- notification_clicked - User tapped notification
-- app_launched         - Session start
-- app_backgrounded     - Session end/suspend
-- share_initiated      - User tapped share
-- share_completed      - Share successfully sent

-- Partitioning strategy by timestamp for high-volume events
-- (D1 handles this automatically; for custom sharding, add _ym suffix)

-- Optimized query views will be created separately
