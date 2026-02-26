# StoryChat Analytics Infrastructure

Complete analytics & growth tracking system for StoryChat.

## Quick Start

```typescript
import { 
  initAnalytics, 
  trackChapterStart, 
  CreditManager,
  AdminDashboardQueries 
} from './tracking';

// Initialize
initAnalytics({ d1Database: env.DB, batchSize: 50 });

// Track events
trackChapterStart('user_123', 'story_456', 'ch_1');

// Credit operations
const credits = new CreditManager(env.DB);
await credits.spend({ userId: 'user_123', amount: 5, storyId: 'story_456', idempotencyKey: 'uniq_123' });

// Admin queries
const admin = new AdminDashboardQueries(env.DB);
const topStories = await admin.getTopStories('30d', 10);
```

## Schema Files

| File | Purpose |
|------|---------|
| `001_events.sql` | Core event tracking table |
| `002_credit_transactions.sql` | Atomic credit ledger |
| `003_engagement_metrics.sql` | Funnel & drop-off tables |
| `004_admin_dashboard.sql` | DAU, revenue, churn tables |
| `005_growth_loops.sql` | Credit gates & webhooks |

## Key Event Types

- `story_viewed`, `chapter_started`, `chapter_completed`
- `message_revealed`, `photo_viewed`
- `credit_spent`, `credit_added`
- `upgrade_prompt_shown`, `upgrade_accepted`, `upgrade_skipped`
- `purchase_clicked`, `purchase_completed`

## Credit System

- **Atomic transactions**: Credit ledger with idempotency keys
- **Double-spend protection**: UNIQUE constraint on idempotency_key
- **Balance calculation**: `SUM(credits)` where type in (PURCHASE, ...) MINUS consumption

## Growth Loops

1. **First chapter free**: Gates start at chapter 2
2. **Progressive engagement**: Bonus credits for waiting/delays
3. **Share webhooks**: Viral completion tracking

## Admin Dashboard Metrics

- DAU/WAU/MAU trends
- Credit revenue (credits × $0.01)
- Top stories by engagement
- Churn prediction (score 0-100)

## Scheduled Jobs

- `calculateChurnRisk()`: Daily
- `flushEvents()`: Every 5s (or batch size)
- Aggregate updates to `top_stories_dashboard`: Hourly
