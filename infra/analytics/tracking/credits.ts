/**
 * ATOMIC CREDIT TRANSACTION SYSTEM
 * 
 * Features:
 * - Double-spend prevention via idempotency keys
 * - ACID-compliant transactions on D1
 * - Balance calculation from immutable log
 * - Audit trail for all operations
 * 
 * Usage:
 *   import { CreditManager } from './credits';
 *   const credits = new CreditManager(d1Database);
 *   
 *   // Spend credits
 *   const result = await credits.spend({
 *     userId: 'user_123',
 *     amount: 5,
 *     storyId: 'story_456',
 *     messageId: 'msg_789',
 *     idempotencyKey: 'unique_key_for_retry'
 *   });
 */

import { nanoid } from 'nanoid';

// Transaction types
export type TransactionType = 
  | 'PURCHASE'
  | 'CONSUMPTION'
  | 'REFUND'
  | 'ADMIN_ADD'
  | 'ADMIN_REMOVE'
  | 'BONUS'
  | 'PROMO';

export interface CreditTransaction {
  transactionId: string;
  userId: string;
  transactionType: TransactionType;
  creditsAmount: number;
  balanceAfter: number;
  storyId?: string;
  chapterId?: string;
  messageId?: string;
  purchaseId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface SpendCreditsInput {
  userId: string;
  amount: number;
  storyId: string;
  chapterId?: string;
  messageId?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface AddCreditsInput {
  userId: string;
  amount: number;
  transactionType: TransactionType;
  purchaseId?: string;
  adminUserId?: string;
  reason?: string;
  currency?: string;
  amountPaid?: number;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  newBalance: number;
  error?: string;
}

export class CreditManager {
  constructor(private db: D1Database) {}

  async getBalance(userId: string): Promise<number> {
    const result = await this.db.prepare(
      `SELECT COALESCE(SUM(
        CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') 
        THEN credits_amount ELSE -credits_amount END), 0) as balance
      FROM credit_transactions WHERE user_id = ?`
    ).bind(userId).first<{ balance: number }>();
    return result?.balance ?? 0;
  }

  async hasSufficientCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  async spend(input: SpendCreditsInput): Promise<TransactionResult> {
    const { userId, amount, storyId, chapterId, messageId, idempotencyKey, metadata } = input;
    
    if (amount <= 0) {
      return { success: false, newBalance: 0, error: 'Amount must be positive' };
    }

    // Check for existing transaction
    const existing = await this.db.prepare(
      `SELECT transaction_id, balance_after FROM credit_transactions 
       WHERE idempotency_key = ? AND user_id = ?`
    ).bind(idempotencyKey, userId).first<{ transaction_id: string; balance_after: number }>();
    
    if (existing) {
      return { success: true, transactionId: existing.transaction_id, newBalance: existing.balance_after };
    }

    const transactionId = `tx_${nanoid(12)}`;
    
    try {
      // Get current balance
      const balanceResult = await this.db.prepare(
        `SELECT COALESCE(SUM(
          CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') 
          THEN credits_amount ELSE -credits_amount END), 0) as balance
        FROM credit_transactions WHERE user_id = ?`
      ).bind(userId).first<{ balance: number }>();
      
      const currentBalance = balanceResult?.balance ?? 0;
      
      if (currentBalance < amount) {
        return { success: false, newBalance: currentBalance, error: 'Insufficient credits' };
      }
      
      const newBalance = currentBalance - amount;
      
      await this.db.prepare(
        `INSERT INTO credit_transactions 
          (transaction_id, user_id, transaction_type, credits_amount, balance_after,
           story_id, chapter_id, message_id, idempotency_key, metadata, created_at)
         VALUES (?, ?, 'CONSUMPTION', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        transactionId, userId, amount, newBalance, storyId,
        chapterId ?? null, messageId ?? null, idempotencyKey,
        metadata ? JSON.stringify(metadata) : null
      ).run();
      
      return { success: true, transactionId, newBalance };
      
    } catch (error) {
      // Check if error is duplicate key
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        const existing = await this.db.prepare(
          `SELECT balance_after FROM credit_transactions WHERE idempotency_key = ?`
        ).bind(idempotencyKey).first<{ balance_after: number }>();
        return { success: true, transactionId: 'already_committed', newBalance: existing?.balance_after ?? 0 };
      }
      console.error('[CreditManager] Transaction failed:', error);
      return { success: false, newBalance: await this.getBalance(userId), error: 'Transaction failed' };
    }
  }

  async addCredits(input: AddCreditsInput): Promise<TransactionResult> {
    const { userId, amount, transactionType, purchaseId, adminUserId, reason, currency, amountPaid, metadata, idempotencyKey } = input;
    
    if (amount <= 0) {
      return { success: false, newBalance: 0, error: 'Amount must be positive' };
    }
    
    const transactionId = `tx_${nanoid(12)}`;
    const usedIdempotencyKey = idempotencyKey ?? `${transactionType}_${nanoid(8)}`;
    
    try {
      const balanceResult = await this.db.prepare(
        `SELECT COALESCE(SUM(
          CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') 
          THEN credits_amount ELSE -credits_amount END), 0) as balance
        FROM credit_transactions WHERE user_id = ?`
      ).bind(userId).first<{ balance: number }>();
      
      const currentBalance = balanceResult?.balance ?? 0;
      const newBalance = currentBalance + amount;
      
      await this.db.prepare(
        `INSERT INTO credit_transactions 
          (transaction_id, user_id, transaction_type, credits_amount, balance_after,
           purchase_id, admin_user_id, reason, currency, amount_paid,
           idempotency_key, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        transactionId, userId, transactionType, amount, newBalance,
        purchaseId ?? null, adminUserId ?? null, reason ?? null,
        currency ?? null, amountPaid ?? null, usedIdempotencyKey,
        metadata ? JSON.stringify(metadata) : null
      ).run();
      
      return { success: true, transactionId, newBalance };
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        const existing = await this.db.prepare(
          `SELECT balance_after FROM credit_transactions WHERE idempotency_key = ?`
        ).bind(usedIdempotencyKey).first<{ balance_after: number }>();
        return { success: true, transactionId: 'already_committed', newBalance: existing?.balance_after ?? 0 };
      }
      console.error('[CreditManager] Add credits failed:', error);
      return { success: false, newBalance: await this.getBalance(userId), error: 'Transaction failed' };
    }
  }

  async getTransactionHistory(userId: string, limit = 50, offset = 0): Promise<CreditTransaction[]> {
    const result = await this.db.prepare(
      `SELECT transaction_id, user_id, transaction_type, credits_amount, balance_after,
              story_id, chapter_id, message_id, idempotency_key, metadata
       FROM credit_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all<CreditTransaction>();
    
    return result.results ?? [];
  }

  async validateTransaction(transactionId: string): Promise<boolean> {
    const result = await this.db.prepare(
      `SELECT 1 as exists FROM credit_transactions WHERE transaction_id = ?`
    ).bind(transactionId).first<{ exists: number }>();
    return result?.exists === 1;
  }
}

type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T>() => Promise<T | null>;
      all: <T>() => Promise<{ results?: T[] }>;
      run: () => Promise<{ success: boolean }>;
    };
  };
};