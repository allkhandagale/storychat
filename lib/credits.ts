/**
 * Credit Management SDK
 * Provides atomic credit operations with D1 transactions
 * Prevents double-spend via idempotency keys
 */

import type { D1Database } from '@cloudflare/workers-types';

// Idempotency key store for deduplication
const idempotencyStore = new Map<string, { processed: boolean; result: unknown }>();

export interface DeductResult {
  success: boolean;
  newBalance: number;
}

export interface UnlockResult {
  success: boolean;
  message: string;
}

export interface CreditRecord {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface ChapterUnlockRecord {
  user_id: string;
  chapter_id: string;
  unlocked_at: string;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  type: 'credit_add' | 'credit_deduct' | 'chapter_unlock';
  amount?: number;
  chapter_id?: string;
  reason?: string;
  created_at: string;
}

/**
 * Get user's current credit balance
 */
export async function getBalance(
  db: D1Database,
  userId: string
): Promise<number> {
  const result = await db
    .prepare('SELECT balance FROM user_credits WHERE user_id = ?')
    .bind(userId)
    .first<{ balance: number }>();

  return result?.balance ?? 0;
}

/**
 * Add credits to user's balance
 */
export async function addCredits(
  db: D1Database,
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const result = await db
    .prepare(
      `INSERT INTO user_credits (user_id, balance, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT (user_id) DO UPDATE SET
       balance = balance + excluded.balance,
       updated_at = datetime('now')`
    )
    .bind(userId, amount)
    .run();

  // Log transaction
  await db
    .prepare(
      `INSERT INTO credit_transactions (user_id, type, amount, reason, created_at)
       VALUES (?, 'credit_add', ?, ?, datetime('now'))`
    )
    .bind(userId, amount, reason)
    .run();

  return result.success;
}

/**
 * Deduct credits from user's balance with idempotency support
 */
export async function deductCredits(
  db: D1Database,
  userId: string,
  amount: number,
  idempotencyKey?: string
): Promise<DeductResult> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  // Check idempotency key
  if (idempotencyKey) {
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing) {
      return existing.result as DeductResult;
    }
  }

  const result = await db.batch([
    // Deduct credits atomically
    db
      .prepare(
        `UPDATE user_credits
         SET balance = balance - ?,
             updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`
      )
      .bind(amount, userId, amount),
    // Log transaction
    db
      .prepare(
        `INSERT INTO credit_transactions (user_id, type, amount, created_at)
         SELECT ?, 'credit_deduct', ?, datetime('now')
         WHERE EXISTS (
           SELECT 1 FROM user_credits WHERE user_id = ? AND balance >= 0
         )`
      )
      .bind(userId, amount, userId),
  ]);

  const updateResult = result[0];
  const success = updateResult.meta?.changes === 1;

  // Get updated balance
  const newBalance = await getBalance(db, userId);

  const deductResult: DeductResult = {
    success,
    newBalance,
  };

  // Store idempotency result
  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, {
      processed: true,
      result: deductResult,
    });
  }

  return deductResult;
}

/**
 * Check if user has unlocked a chapter
 */
export async function hasUnlockedChapter(
  db: D1Database,
  userId: string,
  chapterId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      'SELECT 1 FROM chapter_unlocks WHERE user_id = ? AND chapter_id = ?'
    )
    .bind(userId, chapterId)
    .first();

  return result !== null;
}

/**
 * Unlock a chapter with atomic credit deduction
 * Prevents double-spend via idempotency key
 */
export async function unlockChapter(
  db: D1Database,
  userId: string,
  chapterId: string,
  cost: number = 10,
  idempotencyKey?: string
): Promise<UnlockResult> {
  // Generate idempotency key if not provided
  const key = idempotencyKey ?? `unlock:${userId}:${chapterId}`;

  // Check idempotency
  const existing = idempotencyStore.get(key);
  if (existing) {
    return existing.result as UnlockResult;
  }

  // Check if already unlocked
  const alreadyUnlocked = await hasUnlockedChapter(db, userId, chapterId);
  if (alreadyUnlocked) {
    const result: UnlockResult = {
      success: true,
      message: 'Chapter already unlocked',
    };
    idempotencyStore.set(key, { processed: true, result });
    return result;
  }

  // Atomic transaction: deduct credits AND unlock chapter
  const result = await db.batch([
    // Deduct credits
    db
      .prepare(
        `UPDATE user_credits
         SET balance = balance - ?,
             updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`
      )
      .bind(cost, userId, cost),
    // Unlock chapter
    db
      .prepare(
        `INSERT INTO chapter_unlocks (user_id, chapter_id, unlocked_at)
         SELECT ?, ?, datetime('now')
         WHERE EXISTS (
           SELECT 1 FROM user_credits WHERE user_id = ? AND balance >= 0
         )`
      )
      .bind(userId, chapterId, userId),
    // Log credit transaction
    db
      .prepare(
        `INSERT INTO credit_transactions (user_id, type, amount, chapter_id, reason, created_at)
         SELECT ?, 'credit_deduct', ?, ?, 'chapter_unlock', datetime('now')
         WHERE EXISTS (
           SELECT 1 FROM user_credits WHERE user_id = ? AND balance >= 0
         )`
      )
      .bind(userId, cost, chapterId, userId),
    // Log chapter unlock transaction
    db
      .prepare(
        `INSERT INTO chapter_transactions (user_id, chapter_id, cost, created_at)
         SELECT ?, ?, ?, datetime('now')
         WHERE EXISTS (
           SELECT 1 FROM user_credits WHERE user_id = ? AND balance >= 0
         )`
      )
      .bind(userId, chapterId, cost, userId),
  ]);

  const updateResult = result[0];
  const success = updateResult.meta?.changes === 1;

  if (!success) {
    const unlockResult: UnlockResult = {
      success: false,
      message: 'Insufficient credits',
    };
    idempotencyStore.set(key, { processed: true, result: unlockResult });
    return unlockResult;
  }

  const unlockResult: UnlockResult = {
    success: true,
    message: 'Chapter unlocked successfully',
  };

  idempotencyStore.set(key, { processed: true, result: unlockResult });
  return unlockResult;
}

/**
 * Clear idempotency cache (useful for testing or periodic cleanup)
 */
export function clearIdempotencyCache(): void {
  idempotencyStore.clear();
}

/**
 * Remove a specific idempotency key (for testing)
 */
export function removeIdempotencyKey(key: string): void {
  idempotencyStore.delete(key);
}
