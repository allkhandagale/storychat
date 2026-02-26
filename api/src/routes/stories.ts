/**
 * Stories Routes - Hono Router
 * Endpoints: GET /api/stories, GET /api/stories/:id
 */
import { Hono } from 'hono';
import type { Env } from '../index';

type StoriesContext = { Bindings: Env; Variables: { userId?: string } };
const stories = new Hono<StoriesContext>();

async function verifyJWT(token: string, secret: string): Promise<any> {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) throw new Error('Invalid token');
  const data = new TextEncoder().encode(`${header}.${body}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) throw new Error('Invalid signature');
  return JSON.parse(atob(body));
}

async function optionalAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
      if (payload.userId) c.set('userId', payload.userId);
    } catch { /* continue without user */ }
  }
  await next();
}

// GET /api/stories - List all published stories
stories.get('/', optionalAuth, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  try {
    const result = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM chapters WHERE story_id = s.id) as chapter_count FROM stories s WHERE s.status = 'PUBLISHED' ORDER BY s.published_at DESC`).all<{ id: string; title: string; genre: string; synopsis: string; cover_image_key: string; total_reads: number; chapter_count: number }>();
    const storyList = result.results || [];
    return c.json({ stories: storyList.map(s => ({ id: s.id, title: s.title, genre: s.genre, synopsis: s.synopsis, coverImage: s.cover_image_key, totalReads: s.total_reads, chapterCount: s.chapter_count })), count: storyList.length });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch stories' }, 500);
  }
});

// GET /api/stories/:id - Get story details
stories.get('/:id', optionalAuth, async (c) => {
  const db = c.env.DB;
  const storyId = c.req.param('id');
  const userId = c.get('userId');
  try {
    const story = await db.prepare(`SELECT * FROM stories WHERE id = ? AND status = 'PUBLISHED'`).bind(storyId).first<{ id: string; title: string; genre: string; synopsis: string; cover_image_key: string; total_reads: number }>();
    if (!story) return c.json({ error: 'Story not found' }, 404);
    const chapters = await db.prepare(`SELECT id, chapter_number, title, is_free, unlock_cost FROM chapters WHERE story_id = ? ORDER BY chapter_number`).bind(storyId).all<{ id: string; chapter_number: number; title: string; is_free: number; unlock_cost: number }>();
    const chapterList = (chapters.results || []).map(c => ({ id: c.id, chapterNumber: c.chapter_number, title: c.title, isFree: c.is_free === 1, unlockCost: c.unlock_cost }));
    return c.json({ story: { id: story.id, title: story.title, genre: story.genre, synopsis: story.synopsis, coverImage: story.cover_image_key, totalReads: story.total_reads, chapters: chapterList } });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch story' }, 500);
  }
});

export default stories;
export { stories };
