-- Demo Stories Seed Data
-- 4 Stories x 4 Chapters each = 16 chapters
-- Stories: The Last Message, Love Maybe, Starship Omega, Midnight Confessions

-- Story 1: The Last Message (Thriller)
INSERT INTO stories (id, title, author_id, genre, synopsis, status, total_chapters, created_at, published_at) VALUES (
  'story_thriller_001',
  'The Last Message',
  'admin_user_001',
  'THRILLER',
  'A cryptic text message from a missing friend leads Sarah down a rabbit hole of secrets and lies. Every message reveals another layer of the mystery.',
  'PUBLISHED',
  4,
  datetime('now'),
  datetime('now')
);

-- Characters for Story 1
INSERT INTO characters (id, story_id, name, color_theme, is_narrator, display_order) VALUES
  ('char_t1_sarah', 'story_thriller_001', 'Sarah', '#4CAF50', FALSE, 1),
  ('char_t1_detective', 'story_thriller_001', 'Detective Chen', '#2196F3', FALSE, 2),
  ('char_t1_unknown', 'story_thriller_001', 'Unknown', '#9E9E9E', FALSE, 3),
  ('char_t1_narrator', 'story_thriller_001', 'Narrator', '#000000', TRUE, 4);

-- Chapters for Story 1
INSERT INTO chapters (id, story_id, chapter_number, title, is_free, unlock_cost, created_at, published_at) VALUES
  ('ch_t1_01', 'story_thriller_001', 1, 'The Disappearance', TRUE, 0, datetime('now'), datetime('now')),
  ('ch_t1_02', 'story_thriller_001', 2, 'The Clue', FALSE, 10, datetime('now'), datetime('now')),
  ('ch_t1_03', 'story_thriller_001', 3, 'The Secret', FALSE, 10, datetime('now'), datetime('now')),
  ('ch_t1_04', 'story_thriller_001', 4, 'The Truth', FALSE, 10, datetime('now'), datetime('now'));

-- Messages for Chapter 1 (The first chapter - free)
INSERT INTO messages (id, chapter_id, sequence_index, sender_type, character_id, content, delay_seconds) VALUES
  ('msg_t1_01', 'ch_t1_01', 1, 'NARRATOR', 'char_t1_narrator', 'March 15th, 2024. Portland Police Department.', 1),
  ('msg_t1_02', 'ch_t1_01', 2, 'CHARACTER', 'char_t1_sarah', 'Why is there no one here at this hour?', 2),
  ('msg_t1_03', 'ch_t1_01', 3, 'CHARACTER', 'char_t1_sarah', 'This is the third precinct Ive been to.', 1),
  ('msg_t1_04', 'ch_t1_01', 4, 'CHARACTER', 'char_t1_detective', 'You must be Sarah Martins.', 2),
  ('msg_t1_05', 'ch_t1_01', 5, 'CHARACTER', 'char_t1_sarah', 'Yes! Do you have news about Emily?', 1),
  ('msg_t1_06', 'ch_t1_01', 6, 'CHARACTER', 'char_t1_detective', 'I found something on her phone.', 3),
  ('msg_t1_07', 'ch_t1_01', 7, 'CHARACTER', 'char_t1_unknown', '|{Last message sent at 3:47 AM}|', 2),
  ('msg_t1_08', 'ch_t1_01', 8, 'CHARACTER', 'char_t1_sarah', 'Thats her, she sent me something...', 1);

-- === STORY 2: Love, Maybe (Romance) ===
INSERT INTO stories (id, title, author_id, genre, synopsis, status, total_chapters, created_at, published_at) VALUES (
  'story_romance_001',
  'Love, Maybe',
  'admin_user_001',
  'ROMANCE',
  'Alex and Jordan were high school best friends who lost touch. Five years later, a group chat reconnection sparks something neither expected.',
  'PUBLISHED',
  4,
  datetime('now'),
  datetime('now')
);

INSERT INTO characters (id, story_id, name, color_theme, is_narrator, display_order) VALUES
  ('char_r1_alex', 'story_romance_001', 'Alex', '#E91E63', FALSE, 1),
  ('char_r1_jordan', 'story_romance_001', 'Jordan', '#03A9F4', FALSE, 2),
  ('char_r1_maya', 'story_romance_001', 'Maya', '#FF9800', FALSE, 3),
  ('char_r1_narrator', 'story_romance_001', 'Narrator', '#000000', TRUE, 4);

INSERT INTO chapters (id, story_id, chapter_number, title, is_free, unlock_cost, created_at, published_at) VALUES
  ('ch_r1_01', 'story_romance_001', 1, 'The Reunion Text', TRUE, 0, datetime('now'), datetime('now')),
  ('ch_r1_02', 'story_romance_001', 2, 'Late Night DMs', FALSE, 10, datetime('now'), datetime('now')),
  ('ch_r1_03', 'story_romance_001', 3, 'The Confession', FALSE, 10, datetime('now'), datetime('now')),
  ('ch_r1_04', 'story_romance_001', 4, 'Love, Actually', FALSE, 10, datetime('now'), datetime('now'));

INSERT INTO messages (id, chapter_id, sequence_index, sender_type, character_id, content, delay_seconds) VALUES
  ('msg_r1_01', 'ch_r1_01', 1, 'CHARACTER', 'char_r1_maya', 'OMG GUYS!!', 2),
  ('msg_r1_02', 'ch_r1_01', 2, 'CHARACTER', 'char_r1_maya', 'Is this really happening??', 2),
  ('msg_r1_03', 'ch_r1_01', 3, 'CHARACTER', 'char_r1_alex', 'Maya calm down lol', 1),
  ('msg_r1_04', 'ch_r1_01', 4, 'CHARACTER', 'char_r1_jordan', 'Whats going on?', 2),
  ('msg_r1_05', 'ch_r1_01', 5, 'CHARACTER', 'char_r1_maya', 'Alex Jordan added both of you to this chat', 1),
  ('msg_r1_06', 'ch_r1_01', 6, 'CHARACTER', 'char_r1_alex', '...hi Jordan', 3),
  ('msg_r1_07', 'ch_r1_01', 7, 'CHARACTER', 'char_r1_jordan', 'Hey Alex. Been a while.', 2),
  ('msg_r1_08', 'ch_r1_01', 8, 'NARRATOR', 'char_r1_narrator', 'Five years. Five years since they last spoke.', 1);

-- === STORY 3: Starship Omega (Sci-Fi) ===
INSERT INTO stories (id, title, author_id, genre, synopsis, status, total_chapters, created_at, published_at) VALUES (
  'story_scifi_001',
  'Starship Omega',
  'admin_user_001',
  'SCIFI',
  'Commander Reyes is the last human on a colony ship traveling to Kepler-442b. But they are not alone.',
  'PUBLISHED',
  4,
  datetime('now'),
  datetime('now')
);

INSERT INTO characters (id, story_id, name, color_theme, is_narrator, display_order) VALUES
  ('char_s1_reyes', 'story_scifi_001', 'Commander Reyes', '#00BCD4', FALSE, 1),
  ('char_s1_echo', 'story_scifi_001', 'ECHO-7', '#8BC34A', FALSE, 2),
  ('char_s1_unknown', 'story_scifi_001', '???', '#F44336', FALSE, 3),
  ('char_s1_narrator', 'story_scifi_001', 'Narrator', '#000000', TRUE, 4);

INSERT INTO chapters (id, story_id, chapter_number, title, is_free, unlock_cost, created_at, published_at) VALUES
  ('ch_s1_01', 'story_scifi_001', 1, 'Day 4,782', TRUE, 0, datetime('now'), datetime('now')),
  ('ch_s1_02', 'story_scifi_001', 2, 'The Anomaly', FALSE, 10, datetime('now'), datetime('now')),
  ('ch_s1_03', 'story_scifi_001', 3, 'The Descent',