// Stories routes: List, get details, with unlock status

import type { Env } from '../index';
import { createCORSResponse } from '../index';
import { authenticateRequest } from '../middleware/auth';

export async function storyRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const db = env.DB;

  // GET /api/stories - List all published stories with unlock status
  if (path === '/api/stories' && method === 'GET') {
    try {
      // Get optional auth for user-specific unlock status
      const auth = await authenticateRequest(request, env);
      const userId = auth?.userId;

      // Get all published stories
      const stories = await db.prepare(`
        SELECT s.*,
               (SELECT COUNT(*) FROM chapters WHERE story_id = s.id) as chapter_count
        FROM stories s
        WHERE s.status = 'PUBLISHED'
        ORDER BY s.published_at DESC, s.created_at DESC
      `).all<{
        id: string;
        title: string;
        genre: string;
        synopsis: string;
        cover_image_key: string;
        total_reads: number;
        chapter_count: number;
      }>();

      const storyList = stories.results || [];

      // If user is authenticated, get their unlock status
      let userUnlocked: Set<string> = new Set();
      if (userId) {
        const unlocked = await db.prepare(`
          SELECT c.story_id, COUNT(*) as unlocked_count
          FROM user_chapters uc
          JOIN chapters c ON uc.chapter_id = c.id
          WHERE uc.user_id = ?
          GROUP BY c.story_id
        `).bind(userId).all<{ story_id: string; unlocked_count: number }>();

        for (const row of unlocked.results || []) {
          userUnlocked.add(row.story_id);
        }
      }

      // Get user's last progress
      let userProgress: Map<string, number> = new Map();
      if (userId) {
        const progress = await db.prepare(`
          SELECT story_id, MAX(last_message_index) as max_message, MAX(completed_at) as completed
          FROM user_chapters
          WHERE user_id = ?
          GROUP BY story_id
        `).bind(userId).all<{ story_id: string; max_message: number; completed: string }>();

        for (const row of progress.results || []) {
          userProgress.set(row.story_id, row.max_message);
        }
      }

      // Enrich response
      const enrichedStories = storyList.map(story => ({
        id: story.id,
        title: story.title,
        genre: story.genre,
        synopsis: story.synopsis,
        coverImage: story.cover_image_key ? `/api/media/${story.cover_image_key}` : null,
        totalReads: story.total_reads,
        chapterCount: story.chapter_count,
        unlockedChapterCount: 0, // TODO: calculate
        started: userProgress.has(story.id),
        lastMessageRead: userProgress.get(story.id) || 0
      }));

      return createCORSResponse({ stories: enrichedStories, count: enrichedStories.length }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to fetch stories' }, 500, env.CORS_ORIGIN);
    }
  }

  // GET /api/stories/:id - Get story details with chapters
  if (path.match(/^/api/stories/[^/]+$/) && method === 'GET') {
    try {
      const storyId = path.split('/')[3];
      const auth = await authenticateRequest(request, env);
      const userId = auth?.userId;

      // Get story
      const story = await db.prepare(`
        SELECT s.*
        FROM stories s
        WHERE s.id = ? AND s.status = 'PUBLISHED'
      `).bind(storyId).first<{
        id: string;
        title: string;
        author_id: string;
        genre: string;
        synopsis: string;
        cover_image_key: string;
        total_reads: number;
      }>();

      if (!story) {
        return createCORSResponse({ error: 'Story not found' }, 404, env.CORS_ORIGIN);
      }

      // Get characters
      const characters = await db.prepare(`
        SELECT id, name, avatar_key, color_theme, is_narrator
        FROM characters
        WHERE story_id = ?
        ORDER BY display_order
      `).bind(storyId).all<{ id: string; name: string; avatar_key: string; color_theme: string; is_narrator: number }>();

      // Get chapters with unlock status
      const chapters = await db.prepare(`
        SELECT c.*, uc.unlocked_at, uc.completed_at, uc.last_message_index
        FROM chapters c
        LEFT JOIN user_chapters uc ON c.id = uc.chapter_id AND uc.user_id = ?
        WHERE c.story_id = ?
        ORDER BY c.chapter_number
      `).bind(userId ?? 'no-user', storyId).all<{
        id: string;
        chapter_number: number;
        title: string;
        is_free: number;
        unlock_cost: number;
        total_reads: number;
        unlocked_at: string;
        completed_at: string;
        last_message_index: number;
      }>();

      const chapterList = (chapters.results || []).map(c => ({
        id: c.id,
        chapterNumber: c.chapter_number,
        title: c.title,
        isFree: c.is_free === 1,
        unlockCost: c.unlock_cost,
        totalReads: c.total_reads,
        unlocked: !!c.unlocked_at,
        unlockedAt: c.unlocked_at,
        completed: !!c.completed_at,
        lastMessageRead: c.last_message_index || 0
      }));

      // Increment story view count (fire-and-forget)
      db.prepare('UPDATE stories SET total_reads = total_reads + 1 WHERE id = ?').bind(storyId).run();

      return createCORSResponse({
        story: {
          id: story.id,
          title: story.title,
          genre: story.genre,
          synopsis: story.synopsis,
          coverImage: story.cover_image_key ? `/api/media/${story.cover_image_key}` : null,
          totalReads: story.total_reads + 1,
          characters: (characters.results || []).map(ch => ({
            id: ch.id,
            name: ch.name,
            avatar: ch.avatar_key ? `/api/media/${ch.avatar_key}` : null,
            colorTheme: ch.color_theme,
            isNarrator: ch.is_narrator === 1
          })),
          chapters: chapterList
        }
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to fetch story' }, 500, env.CORS_ORIGIN);
    }
  }

  return createCORSResponse({ error: 'Not found' }, 404, env.CORS_ORIGIN);
}
