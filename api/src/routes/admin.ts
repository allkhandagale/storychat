// Admin routes: Credit management, analytics

import type { Env } from '../index';
import { createCORSResponse, parseBody } from '../index';
import { requireAdmin } from '../middleware/auth';
import { checkAdminRateLimit, checkRateLimit } from '../middleware/ratelimit';
import { generateId } from '../lib/crypto';

export async function adminRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const db = env.DB;

  // All admin routes require admin authentication
  const { auth, response: authError } = await requireAdmin(request, env);
  if (authError) return authError;

  // Rate limit admin operations
  const rateCheck = await checkAdminRateLimit(env.RATELIMIT, auth.userId);
  if (!rateCheck.allowed) {
    return createCORSResponse({ error: 'Admin rate limit exceeded' }, 429, env.CORS_ORIGIN);
  }

  // POST /api/admin/credits/add - Admin grant credits
  if (path === '/api/admin/credits/add' && method === 'POST') {
    try {
      const body = await parseBody<{
        userId: string;
        amount: number;
        reason: string;
      }>(request);

      const { userId, amount, reason } = body;

      if (!userId || !amount || amount <= 0) {
        return createCORSResponse({ error: 'Valid userId and positive amount required' }, 400, env.CORS_ORIGIN);
      }

      // Check user exists
      const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first<{
        id: string;
        email: string;
      }>();

      if (!user) {
        return createCORSResponse({ error: 'User not found' }, 404, env.CORS_ORIGIN);
      }

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
      const newBalance = currentBalance + amount;

      const transactionId = `tx_${Date.now()}`;
      const idempotencyKey = `admin_${auth.userId}_${userId}_${Date.now()}`;

      // Insert transaction
      await db.prepare(`
        INSERT INTO credit_transactions (
          transaction_id, user_id, transaction_type, credits_amount, balance_after,
          admin_user_id, idempotency_key, reason, created_at
        ) VALUES (?, ?, 'ADMIN_ADD', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(transactionId, userId, amount, newBalance, auth.userId, idempotencyKey, reason || 'Admin grant').run();

      // Log analytics
      await db.prepare(`
        INSERT INTO events (user_id, event_type, credits_delta, metadata, platform, timestamp)
        VALUES (?, 'credit_added', ?, ?, 'admin', datetime('now'))
      `).bind(userId, amount, JSON.stringify({ adminId: auth.userId, reason })).run();

      return createCORSResponse({
        success: true,
        transactionId,
        userId,
        amount,
        previousBalance: currentBalance,
        newBalance,
        grantedBy: auth.userId
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to add credits' }, 500, env.CORS_ORIGIN);
    }
  }

  // POST /api/admin/credits/deduct - Admin deduct credits
  if (path === '/api/admin/credits/deduct' && method === 'POST') {
    try {
      const body = await parseBody<{
        userId: string;
        amount: number;
        reason: string;
      }>(request);

      const { userId, amount, reason } = body;

      if (!userId || !amount || amount <= 0) {
        return createCORSResponse({ error: 'Valid userId and positive amount required' }, 400, env.CORS_ORIGIN);
      }

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
        return createCORSResponse({
          error: 'Insufficient credits',
          requested: amount,
          available: currentBalance
        }, 400, env.CORS_ORIGIN);
      }

      const newBalance = currentBalance - amount;
      const transactionId = `tx_${Date.now()}`;
      const idempotencyKey = `admin_deduct_${auth.userId}_${userId}_${Date.now()}`;

      await db.prepare(`
        INSERT INTO credit_transactions (
          transaction_id, user_id, transaction_type, credits_amount, balance_after,
          admin_user_id, idempotency_key, reason, created_at
        ) VALUES (?, ?, 'ADMIN_REMOVE', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(transactionId, userId, amount, newBalance, auth.userId, idempotencyKey, reason || 'Admin deduction').run();

      return createCORSResponse({
        success: true,
        transactionId,
        userId,
        amount: -amount,
        previousBalance: currentBalance,
        newBalance,
        deductedBy: auth.userId
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to deduct credits' }, 500, env.CORS_ORIGIN);
    }
  }

  // GET /api/admin/analytics - Get analytics overview
  if (path === '/api/admin/analytics' && method === 'GET') {
    try {
      // Daily revenue (7 days)
      const revenue = await db.prepare(`
        SELECT DATE(created_at) as date, SUM(credits_amount) as credits
        FROM credit_transactions
        WHERE transaction_type = 'PURCHASE'
          AND created_at >= datetime('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all<{ date: string; credits: number }>();

      // Story performance
      const storyStats = await db.prepare(`
        SELECT s.id, s.title, s.total_reads, s.total_chapters,
               COUNT(DISTINCT uc.user_id) as unique_readers,
               SUM(CASE WHEN uc.unlocked_at IS NOT NULL THEN 1 ELSE 0 END) as total_unlocks
        FROM stories s
        LEFT JOIN chapters c ON s.id = c.story_id
        LEFT JOIN user_chapters uc ON c.id = uc.chapter_id
        GROUP BY s.id
        ORDER BY s.total_reads DESC
        LIMIT 10
      `).all<{
        id: string;
        title: string;
        total_reads: number;
        total_chapters: number;
        unique_readers: number;
        total_unlocks: number;
      }>();

      // Credit stats
      const creditStats = await db.prepare(`
        SELECT transaction_type, COUNT(*) as count, SUM(credits_amount) as total
        FROM credit_transactions
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY transaction_type
      `).all<{ transaction_type: string; count: number; total: number }>();

      // User stats
      const userStats = await db.prepare(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN last_login_at >= datetime('now', '-7 days') THEN 1 END) as active_users
        FROM users
      `).first<{ total_users: number; active_users: number }>();

      return createCORSResponse({
        timeframe: '7 days',
        revenue: { daily: revenue.results || [] },
        stories: storyStats.results || [],
        credits: creditStats.results || [],
        users: userStats || { total_users: 0, active_users: 0 }
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Failed to fetch analytics' }, 500, env.CORS_ORIGIN);
    }
  }

  // GET /api