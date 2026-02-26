/**
 * CREDIT GATE SYSTEM
 * First chapter free, gates at chapter 2+, progressive engagement rewards
 */

import { CreditManager } from '../tracking/credits';

export interface GateDecision {
  shouldShow: boolean;
  creditsRequired: number;
  messagesRemaining: number;
  reason: string;
}

export class CreditGateManager {
  constructor(private db: D1Database, private creditManager: CreditManager) {}

  async evaluateGate(
    userId: string,
    storyId: string,
    chapterId: string,
    messageIndex: number,
    totalMessages: number
  ): Promise<GateDecision> {
    // Chapter 1 is always free
    if (chapterId.endsWith('_1') || chapterId === 'chapter_1' || chapterId === '1') {
      return {
        shouldShow: false,
        creditsRequired: 0,
        messagesRemaining: totalMessages - messageIndex,
        reason: 'first_chapter_free'
      };
    }

    // Get gate config
    const config = await this.db.prepare(
      `SELECT messages_free, messages_per_credit, chapter_credits, gate_type
       FROM credit_gates WHERE story_id = ? AND chapter_id = ?`
    ).bind(storyId, chapterId).first<{
      messages_free: number;
      messages_per_credit: number;
      chapter_credits: number;
      gate_type: string;
    }>();

    const messagesFree = config?.messages_free ?? 3;
    const creditsPerMsg = config?.messages_per_credit ?? 1;

    if (messageIndex < messagesFree) {
      return {
        shouldShow: false,
        creditsRequired: 0,
        messagesRemaining: messagesFree - messageIndex,
        reason: 'free_messages_remaining'
      };
    }

    // Calculate credits needed
    const messagesBeyondFree = messageIndex - messagesFree;
    const creditsRequired = Math.ceil(messagesBeyondFree / creditsPerMsg);
    const currentBalance = await this.creditManager.getBalance(userId);

    return {
      shouldShow: currentBalance < creditsRequired,
      creditsRequired,
      messagesRemaining: 0,
      reason: currentBalance < creditsRequired ? 'insufficient_credits' : 'can_continue'
    };
  }

  /**
   * Check if user qualifies for bonus credits (progressive engagement)
   */
  async checkBonusEligibility(userId: string, engagementSeconds: number): Promise<{
    eligible: boolean;
    bonusCredits: number;
    reason: string;
  }> {
    // Progressive: longer wait = more credits
    const tiers = [
      { minSeconds: 300, credits: 1, reason: 'waited_5_min' },    // 5 min
      { minSeconds: 600, credits: 2, reason: 'waited_10_min' },     // 10 min
      { minSeconds: 1800, credits: 5, reason: 'waited_30_min' },  // 30 min
    ];

    for (const tier of tiers.slice().reverse()) {
      if (engagementSeconds >= tier.minSeconds) {
        return {
          eligible: true,
          bonusCredits: tier.credits,
          reason: tier.reason
        };
      }
    }

    return { eligible: false, bonusCredits: 0, reason: 'no_bonus_yet' };
  }
}
