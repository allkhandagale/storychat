// Credits routes: Unlock chapters, get balance, purchase

import type { Env } from '../index';
import { createCORSResponse, parseBody, signJWT, verifyJWT } from '../index';
import { requireAuth } from '../middleware/auth';
import { checkCreditRateLimit, checkRateLimit } from '../middleware/ratelimit';
import { generateId } from '../lib/crypto';

// CreditManager (adapted from Jarvis-Growth SDK)
async function getBalance(db: D1Database, userId: string): Promise<number> {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') THEN credits_amount
           ELSE -credits_amount END
    ), 0) as balance
    FROM credit_transactions
    WHERE user_id = ?
  `).bind(userId).first<{ balance: number }>();
  return result?.balance ?? 0;
}

async function spendCredits(
  db: D1Database,
  userId: string,
  amount: number,
  storyId: string,
  chapterId: string,
  idempotencyKey: string
): Promise<{ success: boolean; transactionId?: string; newBalance?: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  // Check for duplicate (idempotency)
  const existing = await db.prepare(`
    SELECT transaction_id, balance_after FROM credit_transactions
    WHERE idempotency_key = ? AND user_id = ?
  `).bind(idempotencyKey, userId).first<{ transaction_id: string; balance_after: number }>();

  if (existing) {
    return { success: true, transactionId: existing.transaction_id, newBalance: existing.balance_after };
  }

  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Get current balance
    const balanceResult = await db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') THEN credits_amount
             ELSE -credits_amount END
      ), 0) as balance
      FROM credit_transactions
      WHERE user_id = ?
    `).bind(userId).first<{ balance: number }>();

    const currentBalance = balanceResult?.balance ?? 0;

    if (currentBalance < amount) {
      return { success: false, error: 'Insufficient credits', newBalance: currentBalance };
    }

    const newBalance = currentBalance - amount;

    // Insert transaction
    await db.prepare(`
      INSERT INTO credit_transactions (
        transaction_id, user_id, transaction_type, credits_amount, balance_after,
        story_id, chapter_id, idempotency_key, reason, created_at
      ) VALUES (?, ?, 'CONSUMPTION', ?, ?, ?, ?, ?, 'Unlock chapter', datetime('now'))
    `).bind(transactionId, userId, amount, newBalance, storyId, chapterId, idempotencyKey).run();

    return { success: true, transactionId, newBalance };
  } catch (error) {
    console.error('[CreditManager] Transaction failed:', error);
    return { success: false, error: 'Transaction failed', newBalance: await getBalance(db, userId) };
  }
}

export async function creditRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const db = env.DB;

  // GET /api/credits/balance - Get user's credit balance
  if (path === '/api/credits/balance' && method === 'GET') {
    const { auth, response: authError } = await requireAuth(request, env);
    if (authError) return authError;

    try {
      const balance = await getBalance(db, auth.userId);

      // Get transaction history (last 10)
      const transactions = await db.prepare(`
        SELECT transaction_id, transaction_type, credits_amount, balance_after,
               story_id, chapter_id, reason, created_at
        FROM credit_transactions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(auth.userId).all<{
        transaction_id: string;
        transaction_type: string;
        credits_amount: number;
        balance_after: number;
        story_id: string;
        chapter_id: string;
        reason: string;
        created_at: string;
      }>();

      const txList = (transactions.results || []).map(tx => ({
        id: tx.transaction_id,
        type: tx.transaction_type,
        amount: tx.credits_amount,
        balanceAfter: tx.balance_after,
        storyId: tx.story_id,
        chapterId: tx.chapter_id,
        reason: tx.reason,
        timestamp: tx.created_at
      }));

      return createCORSResponse({
        balance,
        recentTransactions: txList
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to get balance' }, 500, env.CORS_ORIGIN);
    }
  }

  // POST /api/credits/unlock - Unlock a chapter
  if (path === '/api/credits/unlock' && method === 'POST') {
    const rateResult = await checkCreditRateLimit(env.RATELIMIT, 'user');
    if (!rateResult.allowed) {
      return createCORSResponse({ error: 'Rate limit exceeded' }, 429, env.CORS_ORIGIN);
    }

    const { auth, response: authError } = await requireAuth(request, env);
    if (authError) return authError;

    try {
      const body = await parseBody<{ chapterId: string; idempotencyKey?: string }>(request);
      const { chapterId, idempotencyKey } = body;

      if (!chapterId) {
        return createCORSResponse({ error: 'Chapter ID required' }, 400, env.CORS_ORIGIN);
      }

      // Get chapter info
      const chapter = await db.prepare(`
        SELECT c.id, c.story_id, c.chapter_number, c.unlock_cost, c.is_free, s.title as story_title
        FROM chapters c
        JOIN stories s ON c.story_id = s.id
        WHERE c.id = ?
      `).bind(chapterId).first<{
        id: string;
        story_id: string;
        chapter_number: number;
        unlock_cost: number;
        is_free: number;
        story_title: string;
      }>();

      if (!chapter) {
        return createCORSResponse({ error: 'Chapter not found' }, 404, env.CORS_ORIGIN);
      }

      // Check if already unlocked
      const alreadyUnlocked = await db.prepare(`
        SELECT id FROM user_chapters WHERE user_id = ? AND chapter_id = ? AND unlocked_at IS NOT NULL
      `).bind(auth.userId, chapterId).first();

      if (alreadyUnlocked) {
        return createCORSResponse({ success: true, message: 'Already unlocked' }, 200, env.CORS_ORIGIN);
      }

      // Free chapter - just create user_chapters entry
      if (chapter.is_free) {
        await db.prepare(`
          INSERT INTO user_chapters (id, user_id, story_id, chapter_id, unlocked_at, created_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(generateId(), auth.userId, chapter.story_id, chapterId).run();

        // Log analytics event
        await db.prepare(`
          INSERT INTO events (user_id, event_type, story_id, chapter_id, credits_delta, platform, timestamp)
          VALUES (?, 'chapter_started', ?, ?, 0, 'web', datetime('now'))
        `).bind(auth.userId, chapter.story_id, chapterId).run();

        return createCORSResponse({
          success: true,
          message: 'Chapter unlocked (free)',
          totalCost: 0,
          creditsRemaining: await getBalance(db, auth.userId)
        }, 200, env.CORS_ORIGIN);
      }

      // Pay for unlock
      const key = idempotencyKey || `unlock_${auth.userId}_${chapterId}_${Date.now()}`;
      const spendResult = await spendCredits(db, auth.userId, chapter.unlock_cost, chapter.story_id, chapterId, key);

      if (!spendResult.success) {
        return createCORSResponse({
          error: spendResult.error,
          requiredCredits: chapter.unlock_cost,
          yourBalance: spendResult.newBalance
        }, 402, env.CORS_ORIGIN); // 402 Payment Required
      }

      // Create user_chapters entry
      await db.prepare(`
        INSERT INTO user_chapters (id, user_id