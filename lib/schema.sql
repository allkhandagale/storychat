-- StoryChat Credit Management Database Schema
-- For Cloudflare D1

-- User credits table
CREATE TABLE IF NOT EXISTS user_credits (
    user_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chapter unlocks table
CREATE TABLE IF NOT EXISTS chapter_unlocks (
    user_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chapter_id)
);

-- Credit transactions table (audit log)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit_add', 'credit_deduct')),
    amount INTEGER,
    chapter_id TEXT,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chapter transactions table (record of unlocks)
CREATE TABLE IF NOT EXISTS chapter_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    cost INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Events table for analytics
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN ('story_viewed', 'chapter_unlocked', 'credit_spent')),
    user_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_user_id ON chapter_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_chapter_id ON chapter_unlocks(chapter_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_chapter_tx_user_id ON chapter_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_tx_chapter_id ON chapter_transactions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
