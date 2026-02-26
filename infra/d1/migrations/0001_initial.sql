-- Initial schema for StoryChat
-- Migration: 0001_initial
-- Creates core tables: users, stories, chapters, messages, wallets, transactions

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Users table: Core user accounts
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    auth_provider TEXT NOT NULL, -- 'google', 'apple', 'email'
    auth_provider_id TEXT,
    credits_balance INTEGER DEFAULT 0,
    subscription_tier TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(auth_provider_id);

-- Stories table: Story metadata
CREATE TABLE stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    genre TEXT,
    synopsis TEXT,
    cover_image_key TEXT, -- R2 key
    is_premium BOOLEAN DEFAULT FALSE,
    credits_per_chapter INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft', -- draft, published, archived
    total_chapters INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_stories_author ON stories(author_id);
CREATE INDEX idx_stories_genre ON stories(genre);
CREATE INDEX idx_stories_status ON stories(status);

-- Chapters table: Story chapters
CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    unlock_cost INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    UNIQUE(story_id, chapter_number)
);

CREATE INDEX idx_chapters_story ON chapters(story_id);

-- Messages table: Individual chat messages within chapters
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    sender_type TEXT DEFAULT 'character', -- character, narrator, system
    content TEXT NOT NULL,
    media_url TEXT, -- R2 key for images
    media_type TEXT, -- image, video
    delay_ms INTEGER DEFAULT 0, -- Simulated typing delay
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);

CREATE INDEX idx_messages_chapter ON messages(chapter_id);

-- Wallets / user progress table: Track reading progress and unlocked chapters
CREATE TABLE user_progress (
    user_id INTEGER NOT NULL,
    story_id INTEGER NOT NULL,
    last_chapter_read INTEGER DEFAULT 0,
    last_message_read INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    unlocked_chapters TEXT DEFAULT '[]', -- JSON array of unlocked chapter IDs
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, story_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_story ON user_progress(story_id);

-- Credit transactions table (atomic ledger): Track all credit movements
CREATE TABLE credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- 'purchase', 'spend', 'refund', 'admin_grant', 'daily_bonus', 'subscription'
    amount INTEGER NOT NULL, -- positive = credit, negative = debit
    balance_after INTEGER NOT NULL,
    reference_id TEXT, -- story_id, subscription_id, admin_id
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_transactions_created ON credit_transactions(created_at);

-- Push subscriptions table: Web push for notifications
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_json TEXT NOT NULL, -- Web Push subscription object
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_push_user ON push_subscriptions(user_id);
