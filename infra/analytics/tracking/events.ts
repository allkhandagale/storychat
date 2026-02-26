/**
 * STORYCHAT EVENT TRACKING SDK
 * 
 * Usage:
 *   import { trackEvent, trackStoryView, trackCreditSpent } from './events';
 *   
 *   await trackEvent({
 *     userId: 'user_123',
 *     eventType: 'message_revealed',
 *     storyId: 'story_456',
 *     chapterId: 'ch_1',
 *     metadata: { messageIndex: 5 }
 *   });
 */

import { nanoid } from 'nanoid';

// Types
export type EventType =
  | 'story_viewed'
  | 'chapter_started'
  | 'chapter_completed'
  | 'message_revealed'
  | 'photo_viewed'
  | 'credit_spent'
  | 'credit_added'
  | 'purchase_clicked'
  | 'purchase_completed'
  | 'upgrade_prompt_shown'
  | 'upgrade_accepted'
  | 'upgrade_skipped'
  | 'notification_sent'
  | 'notification_clicked'
  | 'app_launched'
  | 'app_backgrounded'
  | 'share_initiated'
  | 'share_completed';

export interface TrackEventPayload {
  userId: string;
  eventType: EventType;
  sessionId?: string;
  storyId?: string;
  chapterId?: string;
  messageId?: string;
  creditsDelta?: number;
  metadata?: Record<string, any>;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
}

// Configuration
interface AnalyticsConfig {
  d1Database: D1Database;
  batchSize?: number;
  flushIntervalMs?: number;
  debug?: boolean;
}

let config: AnalyticsConfig | null = null;
let eventQueue: TrackEventPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the analytics SDK
 */
export function initAnalytics(userConfig: AnalyticsConfig): void {
  config = userConfig;
  
  // Set up automatic flushing
  const interval = config.flushIntervalMs ?? 5000;
  flushTimer = setInterval(flushEvents, interval);
  
  if (config.debug) {
    console.log('[Analytics] Initialized with batch size:', config.batchSize ?? 100);
  }
}

/**
 * Track a raw event
 */
export async function trackEvent(payload: TrackEventPayload): Promise<void> {
  if (!config) {
    throw new Error('Analytics not initialized. Call initAnalytics() first.');
  }
  
  // Add to queue for batching
  eventQueue.push(payload);
  
  // Flush if batch size reached
  const batchSize = config.batchSize ?? 100;
  if (eventQueue.length >= batchSize) {
    await flushEvents();
  }
}

/**
 * Flush queued events to D1
 */
export async function flushEvents(): Promise<void> {
  if (!config || eventQueue.length === 0) return;
  
  const batch = eventQueue.splice(0, config.batchSize ?? 100);
  
  try {
    const stmt = config.d1Database.prepare(
      `INSERT INTO events 
        (user_id, event_type, session_id, story_id, chapter_id, message_id, 
         credits_delta, metadata, platform, app_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    const batchPromises = batch.map(event => 
      stmt.bind(
        event.userId,
        event.eventType,
        event.sessionId ?? null,
        event.storyId ?? null,
        event.chapterId ?? null,
        event.messageId ?? null,
        event.creditsDelta ?? 0,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.platform ?? null,
        event.appVersion ?? null
      )
    );
    
    await config.d1Database.batch(batchPromises);
    
    if (config.debug) {
      console.log(`[Analytics] Flushed ${batch.length} events`);
    }
  } catch (error) {
    console.error('[Analytics] Flush failed:', error);
    // Re-queue failed events (with backoff)
    eventQueue.unshift(...batch);
  }
}

/**
 * Track story view
 */
export function trackStoryView(
  userId: string,
  storyId: string,
  metadata?: { source?: string; recommendationId?: string }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'story_viewed',
    storyId,
    metadata
  });
}

/**
 * Track chapter start
 */
export function trackChapterStart(
  userId: string,
  storyId: string,
  chapterId: string,
  metadata?: { fromPush?: boolean; timeSincePushMs?: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'chapter_started',
    storyId,
    chapterId,
    metadata
  });
}

/**
 * Track chapter completion
 */
export function trackChapterComplete(
  userId: string,
  storyId: string,
  chapterId: string,
  metadata?: { creditsSpent: number; timeSpentSeconds: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'chapter_completed',
    storyId,
    chapterId,
    creditsDelta: -(metadata?.creditsSpent ?? 0),
    metadata
  });
}

/**
 * Track message reveal (credit spent)
 */
export function trackMessageRevealed(
  userId: string,
  storyId: string,
  chapterId: string,
  messageId: string,
  creditsSpent: number,
  metadata?: { isPhoto?: boolean }
): Promise<void> {
  const eventType: EventType = metadata?.isPhoto ? 'photo_viewed' : 'message_revealed';
  
  return trackEvent({
    userId,
    eventType,
    storyId,
    chapterId,
    messageId,
    creditsDelta: -creditsSpent,
    metadata: { ...metadata, creditsSpent }
  });
}

/**
 * Track credit transaction
 */
export function trackCreditAdded(
  userId: string,
  creditsAdded: number,
  source: 'purchase' | 'bonus' | 'admin' | 'promo',
  metadata?: Record<string, any>
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'credit_added',
    creditsDelta: creditsAdded,
    metadata: { source, ...metadata }
  });
}

export function trackCreditSpent(
  userId: string,
  creditsSpent: number,
  storyId: string,
  chapterId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'credit_spent',
    storyId,
    chapterId,
    creditsDelta: -creditsSpent,
    metadata
  });
}

/**
 * Track upgrade prompt interactions
 */
export function trackUpgradePromptShown(
  userId: string,
  storyId: string,
  chapterId: string,
  metadata?: { gateType: string; messageIndex: number; creditsNeeded: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'upgrade_prompt_shown',
    storyId,
    chapterId,
    metadata
  });
}

export function trackUpgradeAccepted(
  userId: string,
  storyId: string,
  chapterId: string,
  metadata?: { creditPackage: string; price: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'upgrade_accepted',
    storyId,
    chapterId,
    metadata
  });
}

export function trackUpgradeSkipped(
  userId: string,
  storyId: string,
  chapterId: string
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'upgrade_skipped',
    storyId,
    chapterId
  });
}

/**
 * Track purchase events
 */
export function trackPurchaseClicked(
  userId: string,
  metadata?: { packageId: string; price: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'purchase_clicked',
    metadata
  });
}

export function trackPurchaseCompleted(
  userId: string,
  metadata?: { 
    transactionId: string; 
    packageId: string; 
    credits: number; 
    price: number 
  }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'purchase_completed',
    creditsDelta: metadata?.credits ?? 0,
    metadata
  });
}

/**
 * Track app lifecycle
 */
export function trackAppLaunched(
  userId: string,
  sessionId: string,
  metadata?: { fromPush?: boolean; pushId?: string }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'app_launched',
    sessionId,
    metadata
  });
}

export function trackAppBackgrounded(
  userId: string,
  sessionId: string,
  metadata?: { sessionDurationMs: number }
): Promise<void> {
  return trackEvent({
    userId,
    eventType: 'app_backgrounded',
    sessionId,
    metadata
  });
}

/**
 * Graceful shutdown - flush any remaining events
 */
export async function shutdownAnalytics(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  
  // Flush any remaining events
  if (eventQueue.length > 0) {
    await flushEvents();
  }
  
  if (config?.debug) {
    console.log('[Analytics] Shutdown complete');
  }
}

/**
 * Get current queue size (for monitoring)
 */
export function getQueueSize(): number {
  return eventQueue.length;
}