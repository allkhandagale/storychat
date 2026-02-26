/**
 * Chapters Routes - Hono Router
 * Endpoints: GET /api/chapters/:id (200 if free/unlocked, 402 if locked)
 */
import { Hono } from 'hono';
import type { Env } from '../index';

type ChaptersContext = { Bindings: Env; Variables: { userId?: string } };
const chapters = new Hono<ChaptersContext>();

async function verifyJWT(token: string, secret: string): Promise<any> {
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) throw new Error('Invalid token');
  const data = new TextEncoder().encode(`${h}.${b}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  if (!await crypto.subtle.verify('HMAC', key, sig, data)) throw new Error('Invalid signature');
  return JSON.parse(atob(b));
}

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
    if (!payload.userId) return c.json({ error: 'Invalid token' }, 401);
    c.set('userId', payload.userId);
    await next();
  } catch { return c.json({ error: 'Invalid token' }, 401); }
}

// GET /api/chapters/:id - Get chapter (200 free, 402 locked)
chapters.get('/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const chapterId = c.req.param('id');
  const userId = c.get('userId');
  try {
    const chapter = await db.prepare(`SELECT c.*, s.title as story_title FROM chapters c JOIN stories s ON c.story_id = s.id WHERE c.id = ?`).bind(chapterId).first<{ id: string; is_free: number; unlock_cost: number; story_id: string; chapter_number: number; title: string; story_title: string }>();
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);
    const unlocked = await db.prepare(`SELECT unlocked_at FROM user_chapters WHERE user_id = ? AND chapter_id = ? AND unlocked_at IS NOT NULL`).bind(userId, chapterId).first();
    const isUnlocked = chapter.is_free === 1 || !!unlocked;
    if (!isUnlocked) {
      return c.json({ error: 'Chapter locked', unlockCost: chapter.unlock_cost, storyId: chapter.story_id, chapterId: chapter.id }, 402);
    }
    const messages = await db.prepare(`SELECT m.*, ch.name as character_name FROM messages m LEFT JOIN characters ch ON m.character_id = ch.id WHERE m.chapter_id = ? ORDER BY m.sequence_index`).bind(chapterId).all<{ id: string; sequence_index: number; sender_type: string; character_name: string; content: string }>();
    const msgList = (messages.results || []).map(m => ({ id: m.id, sequenceIndex: m.sequence_index, senderType: m.sender_type, senderName: m.character_name || 'Narrator', content: m.content }));
    return c.json({ chapter: { id: chapter.id, chapterNumber: chapter.chapter_number, title: chapter.title, storyTitle: chapter.story_title, messages: msgList } });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch chapter' }, 500);
  }
});

export default chapters;
export { chapters };
