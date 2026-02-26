-- StoryChat D1 Migration - Initial Schema
-- Based on Chanakya's research + Stark-PM's PRD requirements

-- Users table (supports email/password + OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  auth_provider TEXT NOT NULL, -- 'google', 'email', 'apple'
  auth_provider_id TEXT,
  password_hash TEXT, -- NULL for OAuth users
  is_admin BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'free',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(auth_provider_id);
CREATE INDEX idx_users_admin ON users(is_admin);

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author_id TEXT NOT NULL,
  genre TEXT NOT NULL, -- 'THRILLER', 'ROMANCE', 'SCIFI', 'DRAMA', 'MYSTERY'
  synopsis TEXT,
  cover_image_key TEXT, -- R2 key
  status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'PUBLISHED', 'ARCHIVED'
  total_chapters INTEGER DEFAULT 0,
  total_reads INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_stories_author ON stories(author_id);
CREATE INDEX idx_stories_genre ON stories(genre);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_published ON stories(published_at) WHERE status = 'PUBLISHED';

-- Characters table (for each story)
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_key TEXT, -- R2 key for avatar
  color_theme TEXT, -- hex color
  is_narrator BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX idx_characters_story ON characters(story_id);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  is_free BOOLEAN DEFAULT FALSE, -- First chapter free
  unlock_cost INTEGER DEFAULT 10, -- credits, per PRD spec
  total_unlocks INTEGER DEFAULT 0,
  total_reads INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  UNIQUE(story_id, chapter_number)
);

CREATE INDEX idx_chapters_story ON chapters(story_id);
CREATE INDEX idx_chapters_free ON chapters(is_free);

-- Messages table (chat messages within chapters)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  sequence_index INTEGER NOT NULL,
  sender_type TEXT NOT NULL, -- 'CHARACTER', 'NARRATOR'
  character_id TEXT, -- NULL for narrator or system
  content TEXT NOT NULL,
  media_key TEXT, -- R2 key for images/videos
  media_type TEXT, -- 'image', 'video'
  delay_seconds REAL DEFAULT 2.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE INDEX idx_messages_chapter ON messages(chapter_id);
CREATE INDEX idx_messages_sequence ON messages(sequence_index);

-- User chapters (unlocks + progress)
CREATE TABLE IF NOT EXISTS user_chapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  unlocked_at DATETIME,
  completed_at DATETIME,
  last_message_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  UNIQUE(user_id, chapter_id)
);

CREATE INDEX idx_user_chapters_user ON user_chapters(user_id);
CREATE INDEX idx_user_chapters_story ON user_chapters(story_id);

-- Credit transactions (atomic ledger - per Jarvis-Growth SDK)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'PURCHASE', 'CONSUMPTION', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO'
  credits_amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  story_id TEXT,
  chapter_id TEXT,
  message_id TEXT,
  idempotency_key TEXT NOT NULL,
  purchase_id TEXT,
  admin_user_id TEXT,
  reason TEXT,
  currency TEXT,
  amount_paid REAL,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id),
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);

CREATE INDEX idx_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_transactions_created ON credit_transactions(created_at);
CREATE INDEX idx_transactions_idempotency ON credit_transactions(idempotency_key);

-- Analytics events (from Jarvis-Growth schema)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  story_id TEXT,
  chapter_id TEXT,
  message_id TEXT,
  session_id TEXT,
  credits_delta INTEGER DEFAULT 0,
  metadata TEXT, -- JSON
  platform TEXT,
  app_version TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_user_timestamp ON events(user_id, timestamp);
CREATE INDEX idx_events_story_id ON events(story_id);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_push_user ON push_subscriptions(user_id);
