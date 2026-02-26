/**
 * Credits Routes - Hono Router
 * Endpoints: POST /api/credits/unlock (deduct 10 credits, return chapter), POST /api/credits/admin/add
 */
import { Hono } from 'hono';
import { generateId } from '../lib/crypto';
import type { Env } from '../index';

type CreditsContext = { Bindings: Env; Variables: { userId?: string; isAdmin?: boolean } };
const credits = new Hono<CreditsContext>();

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
    c.set('isAdmin', payload.isAdmin === true);
    await next();
  } catch { return c.json({ error: 'Invalid token' }, 401); }
}

async function requireAdmin(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
    if (!payload.userId) return c.json({ error: 'Invalid token' }, 401);
    if (!payload.isAdmin) return c.json({ error: 'Admin access required' }, 403);
    c.set('userId', payload.userId);
    c.set('isAdmin', true);
    await next();
  } catch { return c.json({ error: 'Invalid token' }, 401); }
}

async function getBalance(db: D1Database, userId: string): Promise<number> {
  const result = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') THEN credits_amount ELSE -credits_amount END), 0) as balance FROM credit_transactions WHERE user_id = ?`).bind(userId).first<{ balance: number }>();
  return result?.balance ?? 0;
}

// POST /api/credits/unlock - Unlock a chapter with credits
credits.post('/unlock', requireAuth, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  try {
    const body = await c.req.json<{ chapterId: string; idempotencyKey?: string }>();
    const { chapterId, idempotencyKey } = body;
    if (!chapterId) return c.json({ error: 'Chapter ID required' }, 400);
    const chapter = await db.prepare(`SELECT c.* FROM chapters c WHERE c.id = ?`).bind(chapterId).first<{ id: string; story_id: string; is_free: number; unlock_cost: number }>();
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);
    const alreadyUnlocked = await db.prepare(`SELECT id FROM user_chapters WHERE user_id = ? AND chapter_id = ? AND unlocked_at IS NOT NULL`).bind(userId, chapterId).first();
    if (alreadyUnlocked) return c.json({ success: true, message: 'Already unlocked', chapterId }, 200);
    if (chapter.is_free === 1) {
      await db.prepare(`INSERT INTO user_chapters (id, user_id, story_id, chapter_id, unlocked_at, created_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).bind(generateId(), userId, chapter.story_id, chapterId).run();
      return c.json({ success: true, message: 'Chapter unlocked (free)', totalCost: 0 });
    }
    const balance = await getBalance(db, userId);
    if (balance < 10) return c.json({ error: 'Insufficient credits', required: 10, balance }, 402);
    const newBalance = balance - 10;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = idempotencyKey || `unlock_${userId}_${chapterId}_${Date.now()}`;
    await db.prepare(`INSERT INTO credit_transactions (transaction_id, user_id, transaction_type, credits_amount, balance_after, story_id, chapter_id, idempotency_key, reason, created_at) VALUES (?, ?, 'CONSUMPTION', 10, ?, ?, ?, ?, 'Unlock chapter', datetime('now'))`).bind(txId, userId, newBalance, chapter.story_id, chapterId, key).run();
    await db.prepare(`INSERT INTO user_chapters (id, user_id, story_id, chapter_id, unlocked_at, created_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).bind(generateId(), userId, chapter.story_id, chapterId).run();
    const messages = await db.prepare(`SELECT m.*, ch.name as character_name FROM messages m LEFT JOIN characters ch ON m.character_id = ch.id WHERE m.chapter_id = ? ORDER BY m.sequence_index`).bind(chapterId).all<{ id: string; content: string; sender_type: string; character_name: string | null }>();
    return c.json({ success: true, message: 'Chapter unlocked', chapterId, creditsUsed: 10, creditsRemaining: newBalance, messages: messages.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to unlock chapter' }, 500);
  }
});

// POST /api/credits/admin/add - Admin add credits to user
credits.post('/admin/add', requireAdmin, async (c) => {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{ userId: string; amount: number; reason?: string }>();
    const { userId: targetUserId, amount, reason } = body;
    if (!targetUserId || !amount || amount <= 0) return c.json({ error: 'User ID and positive amount required' }, 400);
    const currentBalance = await getBalance(db, targetUserId);
    const newBalance = currentBalance + amount;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(`INSERT INTO credit_transactions (transaction_id, user_id, transaction_type, credits_amount, balance_after, idempotency_key, reason, created_at) VALUES (?, ?, 'ADMIN_ADD', ?, ?, ?, ?, datetime('now'))`).bind(txId, targetUserId, amount, newBalance, `admin_${Date.now()}`, reason || 'Admin credit grant').run();
    return c.json({ success: true, userId: targetUserId, amount, newBalance, transactionId: txId });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to add credits' }, 500);
  }
});

// GET /api/credits/balance - Get user credit balance
credits.get('/balance', requireAuth, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  try {
    const balance = await getBalance(db, userId);
    return c.json({ balance, userId });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get balance' }, 500);
  }
});

export default credits;
export { credits };
