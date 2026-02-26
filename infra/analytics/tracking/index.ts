/**
 * STORYCHAT ANALYTICS SDK - Index File
 * Main exports for tracking system
 */

// Event tracking
export {
  initAnalytics,
  trackEvent,
  trackStoryView,
  trackChapterStart,
  trackChapterComplete,
  trackMessageRevealed,
  trackCreditAdded,
  trackCreditSpent,
  trackUpgradePromptShown,
  trackUpgradeAccepted,
  trackUpgradeSkipped,
  trackPurchaseClicked,
  trackPurchaseCompleted,
  trackAppLaunched,
  trackAppBackgrounded,
  flushEvents,
  shutdownAnalytics,
  getQueueSize,
  type EventType,
  type TrackEventPayload
} from './events';

// Credit transactions
export {
  CreditManager,
  type TransactionType,
  type CreditTransaction,
  type SpendCreditsInput,
  type AddCreditsInput,
  type TransactionResult
} from './credits';

// Admin queries
export {
  AdminDashboardQueries,
  type DAUStats,
  type TopStory
} from '../admin/queries';

// Growth loops
export {
  CreditGateManager,
  type GateDecision
} from '../growth/creditGates';

export {
  ShareWebhookManager,
  type WebhookPayload,
  type ShareableCompletion
} from '../growth/shareWebhooks';
