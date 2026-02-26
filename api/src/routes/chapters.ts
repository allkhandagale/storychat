// Chapters routes: Get messages with credit check

import type { Env } from '../index';
import { createCORSResponse } from '../index';
import { requireAuth } from '../middleware/auth';

export async function chapterRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const db = env.DB;

  // GET /api/chapters/:id/messages - Get messages (requires auth & unlock)
  const messagesMatch = path.match(/^/api/chapters/([^/]+)/messages$/);
  if (messagesMatch && method === 'GET') {
    const chapterId = messagesMatch[1];

    // Require authentication
    const { auth, response: authError } = await requireAuth(request, env);
    if (authError) return authError;

    try {
      // Get chapter info
      const chapter = await db.prepare(`
        SELECT c.*, s.title as story_title, s.id as story_id
        FROM chapters c
        JOIN stories s ON c.story_id = s.id
        WHERE c.id = ?
      `).bind(chapterId).first<{
        id: string;
        story_id: string;
        chapter_number: number;
        is_free: number;
        unlock_cost: number;
        story_title: string;
        total_reads: number;
      }>();

      if (!chapter) {
        return createCORSResponse({ error: 'Chapter not found' }, 404, env.CORS_ORIGIN);
      }

      // Check if user has unlocked this chapter
      const userChapter = await db.prepare(`
        SELECT unlocked_at, last_message_index, completed_at
        FROM user_chapters
        WHERE user_id = ? AND chapter_id = ?
      `).bind(auth.userId, chapterId).first<{
        unlocked_at: string;
        last_message_index: number;
        completed_at: string;
      }>();

      const isUnlocked = !!(chapter.is_free || userChapter?.unlocked_at);

      if (!isUnlocked) {
        return createCORSResponse({
          error: 'Chapter locked',
          unlockCost: chapter.unlock_cost,
          storyId: chapter.story_id,
          chapterId: chapter.id
        }, 403, env.CORS_ORIGIN);
      }

      // Get messages
      const messages = await db.prepare(`
        SELECT m.*, ch.name as character_name, ch.color_theme, ch.avatar_key
        FROM messages m
        LEFT JOIN characters ch ON m.character_id = ch.id
        WHERE m.chapter_id = ?
        ORDER BY m.sequence_index ASC
      `).bind(chapterId).all<{
        id: string;
        sequence_index: number;
        sender_type: string;
        character_name: string;
        color_theme: string;
        avatar_key: string;
        content: string;
        media_key: string;
        media_type: string;
        delay_seconds: number;
      }>();

      const messageList = (messages.results || []).map(msg => ({
        id: msg.id,
        sequenceIndex: msg.sequence_index,
        senderType: msg.sender_type,
        senderName: msg.character_name || 'Narrator',
        colorTheme: msg.color_theme,
        avatar: msg.avatar_key ? `/api/media/${msg.avatar_key}` : null,
        content: msg.content,
        media: msg.media_key ? {
          url: `/api/media/${msg.media_key}`,
          type: msg.media_type || 'image'
        } : null,
        delaySeconds: msg.delay_seconds
      }));

      // Update last read message if there are messages
      if (messageList.length > 0 && userChapter) {
        const lastMsgIndex = Math.max(...messageList.map(m => m.sequenceIndex));
        await db.prepare(`
          UPDATE user_chapters
          SET last_message_index = ?,
              updated_at = datetime('now')
          WHERE user_id = ? AND chapter_id = ?
        `).bind(lastMsgIndex, auth.userId, chapterId).run();
      }

      // Increment chapter read count
      db.prepare('UPDATE chapters SET total_reads = total_reads + 1 WHERE id = ?')
        .bind(chapterId).run();

      // Log analytics
      db.prepare(`
        INSERT INTO events (user_id, event_type, story_id, chapter_id, platform, timestamp)
        VALUES (?, 'chapter_started', ?, ?, 'web', datetime('now'))
      `).bind(auth.userId, chapter.story_id, chapterId).run();

      return createCORSResponse({
        chapter: {
          id: chapter.id,
          chapterNumber: chapter.chapter_number,
          storyTitle: chapter.story_title,
          totalReads: chapter.total_reads + 1,
          messages: messageList,
          messageCount: messageList.length,
          progress: {
            lastMessageRead: userChapter?.last_message_index || 0,
            completed: !!userChapter?.completed_at
          }
        }
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to fetch messages' }, 500, env.CORS_ORIGIN);
    }
  }

  // POST /api/chapters/:id/complete - Mark chapter as completed
  const completeMatch = path.match(/^/api/chapters/([^/]+)/complete$/);
  if (completeMatch && method === 'POST') {
    const chapterId = completeMatch[1];

    const { auth, response: authError } = await requireAuth(request, env);
    if (authError) return authError;

    try {
      // Update completion
      await db.prepare(`
        UPDATE user_chapters
        SET completed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ? AND chapter_id = ?
      `).bind(auth.userId, chapterId).run();

      return createCORSResponse({ success: true }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to mark complete' }, 500, env.CORS_ORIGIN);
    }
  }

  return createCORSResponse({ error: 'Not found' }, 404, env.CORS_ORIGIN);
}
