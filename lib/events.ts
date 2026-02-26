/**
 * Events SDK
 * Provides event tracking for analytics and monitoring
 * Event types: story_viewed, chapter_unlocked, credit_spent
 */

import type { D1Database } from '@cloudflare/workers-types';

// Event type definitions
export type EventType = 'story_viewed' | 'chapter_unlocked' | 'credit_spent';

export interface EventMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface EventRecord {
  id: string;
  event_type: EventType;
  user_id: string;
  metadata: string; // JSON stringified
  created_at: string;
}

export interface TrackOptions {
  timestamp?: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Track an event with metadata
 * Event types: story_viewed, chapter_unlocked, credit_spent
 */
export async function track(
  db: D1Database,
  eventType: EventType,
  userId: string,
  metadata: EventMetadata = {},
  options: TrackOptions = {}
): Promise<boolean> {
  // Validate event type
  const validEventTypes: EventType[] = ['story_viewed', 'chapter_unlocked', 'credit_spent'];
  if (!validEventTypes.includes(eventType)) {
    throw new Error(
      `Invalid event type: ${eventType}. Must be one of: ${validEventTypes.join(', ')}`
    );
  }

  // Build enriched metadata
  const enrichedMetadata: EventMetadata = {
    ...metadata,
    ...(options.sessionId && { sessionId: options.sessionId }),
    ...(options.ipAddress && { ipAddress: options.ipAddress }),
    ...(options.userAgent && { userAgent: options.userAgent }),
  };

  // Use provided timestamp or current time
  const timestamp = options.timestamp ?? new Date();

  const result = await db
    .prepare(
      `INSERT INTO events
       (event_type, user_id, metadata, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(
      eventType,
      userId,
      JSON.stringify(enrichedMetadata),
      timestamp.toISOString()
    )
    .run();

  return result.success;
}

/**
 * Track a story view event
 */
export async function trackStoryViewed(
  db: D1Database,
  userId: string,
  storyId: string,
  chapterId?: string,
  metadata: EventMetadata = {},
  options: TrackOptions = {}
): Promise<boolean> {
  return track(
    db,
    'story_viewed',
    userId,
    {
      storyId,
      ...(chapterId && { chapterId }),
      ...metadata,
    },
    options
  );
}

/**
 * Track a chapter unlock event
 */
export async function trackChapterUnlocked(
  db: D1Database,
  userId: string,
  chapterId: string,
  cost?: number,
  metadata: EventMetadata = {},
  options: TrackOptions = {}
): Promise<boolean> {
  return track(
    db,
    'chapter_unlocked',
    userId,
    {
      chapterId,
      ...(cost !== undefined && { cost }),
      ...metadata,
    },
    options
  );
}

/**
 * Track a credit spent event
 */
export async function trackCreditSpent(
  db: D1Database,
  userId: string,
  amount: number,
  reason: 'chapter_unlock' | 'story_premium' | string,
  metadata: EventMetadata = {},
  options: TrackOptions = {}
): Promise<boolean> {
  return track(
    db,
    'credit_spent',
    userId,
    {
      amount,
      reason,
      ...metadata,
    },
    options
  );
}

/**
 * Query events for a user
 */
export async function getUserEvents(
  db: D1Database,
  userId: string,
  eventType?: EventType,
  limit: number = 100
): Promise<EventRecord[]> {
  let query = db
    .prepare(
      `SELECT id, event_type, user_id, metadata, created_at
       FROM events
       WHERE user_id = ?`
    )
    .bind(userId);

  if (eventType) {
    query = db
      .prepare(
        `SELECT id, event_type, user_id, metadata, created_at
         FROM events
         WHERE user_id = ? AND event_type = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(userId, eventType, limit);
  } else {
    query = db
      .prepare(
        `SELECT id, event_type, user_id, metadata, created_at
         FROM events
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(userId, limit);
  }

  const results = await query.all<EventRecord>();
  return results.results ?? [];
}

/**
 * Query events by type within a time range
 */
export async function getEventsByType(
  db: D1Database,
  eventType: EventType,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100
): Promise<EventRecord[]> {
  const start = startDate?.toISOString() ?? '1970-01-01T00:00:00Z';
  const end = endDate?.toISOString() ?? new Date().toISOString();

  const results = await db
    .prepare(
      `SELECT id, event_type, user_id, metadata, created_at
       FROM events
       WHERE event_type = ? AND created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(eventType, start, end, limit)
    .all<EventRecord>();

  return results.results ?? [];
}

/**
 * Get aggregated stats for event types
 */
export async function getEventStats(
  db: D1Database,
  startDate?: Date,
  endDate?: Date
): Promise<{ event_type: string; count: number }[]> {
  const start = startDate?.toISOString() ?? '1970-01-01T00:00:00Z';
  const end = endDate?.toISOString() ?? new Date().toISOString();

  const results = await db
    .prepare(
      `SELECT event_type, COUNT(*) as count
       FROM events
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY event_type`
    )
    .bind(start, end)
    .all<{ event_type: string; count: number }>();

  return results.results ?? [];
}

/**
 * Parse metadata JSON from event record
 */
export function parseMetadata<T extends EventMetadata = EventMetadata>(
  event: EventRecord
): T {
  try {
    return JSON.parse(event.metadata) as T;
  } catch {
    return {} as T;
  }
}
