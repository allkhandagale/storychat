/**
 * SHARE WEBHOOK SYSTEM
 * Social sharing completions for viral growth loops
 */

import { nanoid } from 'nanoid';

export interface WebhookPayload {
  userId: string;
  storyId: string;
  chapterId?: string;
  messageId?: string;
  completionType: 'milestone' | 'chapter' | 'story' | 'achievement';
}

export interface ShareableCompletion {
  userId: string;
  storyId: string;
  chapterId?: string;
  completionType: string;
  shareUrl: string;
  previewText: string;
}

export interface WebhookConfig {
  webhookId: string;
  endpointUrl: string;
  secret?: string;
  triggerEvent: string;
  active: boolean;
}

export class ShareWebhookManager {
  constructor(private db: D1Database) {}

  /**
   * Trigger share completion webhook
   */
  async triggerCompletion(
    payload: WebhookPayload,
    userInitiated: boolean = false,
    platform?: string
  ): Promise<{ success: boolean; webhookIds: string[]; errors: string[] }> {
    const triggeredAt = new Date().toISOString();
    const webhookIds: string[] = [];
    const errors: string[] = [];

    // Get active webhooks for this event type
    const webhooks = await this.db.prepare(
      `SELECT webhook_id, endpoint_url, secret FROM share_webhooks
       WHERE trigger_event = ? AND active = TRUE`
    ).bind(payload.completionType).all<WebhookConfig>();

    for (const webhook of webhooks.results ?? []) {
      try {
        // Build signed payload
        const signature = webhook.secret
          ? await this.signPayload(payload, webhook.secret)
          : undefined;

        // Fire webhook
        const response = await fetch(webhook.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature ?? '',
            'X-StoryChat-Event': payload.completionType
          },
          body: JSON.stringify({
            ...payload,
            triggeredAt,
            userInitiated,
            platform
          })
        });

        // Log result
        const shareId = `share_${nanoid(12)}`;
        await this.db.prepare(
          `INSERT INTO share_completions
           (user_id, story_id, chapter_id, completion_type, webhook_id,
            triggered_at, response_status, success, platform_shared_to,
            share_initiated_by_user, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          payload.userId,
          payload.storyId,
          payload.chapterId ?? null,
          payload.completionType,
          webhook.webhookId,
          triggeredAt,
          response.status,
          response.ok,
          platform ?? null,
          userInitiated
        ).run();

        if (response.ok) {
          webhookIds.push(webhook.webhookId);
        } else {
          errors.push(`${webhook.webhookId}: HTTP ${response.status}`);
        }
      } catch (error) {
        errors.push(`${webhook.webhookId}: ${(error as Error).message}`);
      }
    }

    return {
      success: webhookIds.length > 0,
      webhookIds,
      errors
    };
  }

  /**
   * Generate shareable completion URL
   */
  async generateShareUrl(completion: ShareableCompletion): Promise<string> {
    const shareToken = nanoid(16);
    
    // Store share intent
    await this.db.prepare(
      `INSERT INTO share_completions
       (user_id, story_id, chapter_id, completion_type, share_initiated_by_user, created_at)
       VALUES (?, ?, ?, ?, TRUE, datetime('now'))`
    ).bind(
      completion.userId,
      completion.storyId,
      completion.chapterId ?? null,
      completion.completionType
    ).run();

    return `${completion.shareUrl}?ref=${shareToken}&story=${completion.storyId}`;
  }

  /**
   * HMAC signature for webhook security
   */
  private async signPayload(
    payload: WebhookPayload,
    secret: string
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Get share metrics
   */
  async getShareStats(days = 30): Promise<{
    totalShares: number;
    userInitiatedShares: number;
    webhookSuccessRate: number;
    topStories: { storyId: string; shares: number }[];
  }> {
    const stats = await this.db.prepare(
      `SELECT 
        COUNT(*) as totalShares,
        COUNT(CASE WHEN share_initiated_by_user = TRUE THEN 1 END) as userInitiated,
        ROUND(100.0 * SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as successRate
      FROM share_completions
      WHERE created_at >= date('now', '-${days} days')`
    ).first<{ totalShares: number; userInitiated: number; successRate: number }>();

    const topStories = await this.db.prepare(
      `SELECT story_id as storyId, COUNT(*) as shares
      FROM share_completions
      WHERE created_at >= date('now', '-${days} days')
      GROUP BY story_id
      ORDER BY shares DESC
      LIMIT 10`
    ).all<{ storyId: string; shares: number }>();

    return {
      totalShares: stats?.totalShares ?? 0,
      userInitiatedShares: stats?.userInitiated ?? 0,
      webhookSuccessRate: stats?.successRate ?? 0,
      topStories: topStories.results ?? []
    };
  }
}
