/**
 * ADMIN DASHBOARD QUERIES
 * Optimized queries for D1 (SQLite) - Cloudflare Workers compatible
 */

export interface DAUStats {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
}

export interface TopStory {
  storyId: string;
  uniqueReaders: number;
  totalStarts: number;
  completions: number;
  completionRate: number;
  creditsConsumed: number;
  estimatedRevenue: number;
}

export class AdminDashboardQueries {
  constructor(private db: D1Database) {}

  async getDAUTrend(days = 30): Promise<DAUStats[]> {
    const result = await this.db.prepare(
      `SELECT date, dau, wau, mau, new_users as newUsers,
              returning_users as returningUsers
       FROM daily_active_users
       WHERE date >= date('now', '-${days} days')
       ORDER BY date ASC`
    ).all<DAUStats>();
    return result.results ?? [];
  }

  async getTodayStats(): Promise<{
    dau: number;
    revenue: number;
    creditsConsumed: number;
    highRiskUsers: number;
  }> {
    const dau = await this.db.prepare(
      `SELECT dau, credit_revenue as revenue, credits_consumed as creditsConsumed
       FROM daily_active_users WHERE date = date('now')`
    ).first<{ dau: number; revenue: number; creditsConsumed: number }>();

    const churn = await this.db.prepare(
      `SELECT COUNT(*) as count FROM churn_prediction
       WHERE churn_risk_score >= 50 AND notified = FALSE`
    ).first<{ count: number }>();

    return {
      dau: dau?.dau ?? 0,
      revenue: dau?.revenue ?? 0,
      creditsConsumed: dau?.creditsConsumed ?? 0,
      highRiskUsers: churn?.count ?? 0
    };
  }

  async getTopStories(days = 30, limit = 20): Promise<TopStory[]> {
    const result = await this.db.prepare(
      `SELECT 
        story_id as storyId,
        COUNT(DISTINCT user_id) as uniqueReaders,
        COUNT(*) as totalStarts,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completions,
        ROUND(100.0 * COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) as completionRate,
        COALESCE(SUM(credits_spent), 0) as creditsConsumed,
        ROUND(COALESCE(SUM(credits_spent), 0) * 0.01, 2) as estimatedRevenue
       FROM story_funnels
       WHERE started_at >= date('now', '-${days} days')
       GROUP BY story_id
       ORDER BY uniqueReaders DESC
       LIMIT ${limit}`
    ).all<TopStory>();
    return result.results ?? [];
  }

  async calculateChurnRisk(): Promise<{ updated: number }> {
    // Clear old
    await this.db.prepare(`DELETE FROM churn_prediction`).run();
    
    // Insert new churn predictions
    await this.db.prepare(
      `INSERT INTO churn_prediction (user_id, current_credits, last_engagement_at,
       days_since_engagement, churn_risk_score, risk_bucket, calculated_at)
       SELECT 
         u.user_id,
         COALESCE(u.credit_balance, 0) as current_credits,
         MAX(s.last_engagement) as last_engagement_at,
         COALESCE(julianday('now') - julianday(MAX(s.last_engagement)), 999) as days_since_engagement,
         10 * (CASE WHEN COALESCE(u.credit_balance, 0) < 10 THEN 2 ELSE 0 END +
               CASE WHEN COALESCE(julianday('now') - julianday(MAX(s.last_engagement)), 999) > 14 THEN 5 ELSE 0 END +
               CASE WHEN COUNT(s.story_id) < 2 THEN 2 ELSE 0 END) as churn_risk_score,
         CASE 
           WHEN 10 * (...) >= 70 THEN 'critical'
           WHEN 10 * (...) >= 50 THEN 'high'
           WHEN 10 * (...) >= 30 THEN 'medium'
           ELSE 'low'
         END as risk_bucket,
         datetime('now') as calculated_at
       FROM (
         SELECT user_id, 
           SUM(CASE WHEN transaction_type IN ('PURCHASE', 'REFUND', 'ADMIN_ADD', 'BONUS', 'PROMO') 
           THEN credits_amount ELSE -credits_amount END) as credit_balance
         FROM credit_transactions GROUP BY user_id
       ) u
       LEFT JOIN story_funnels s ON u.user_id = s.user_id
       GROUP BY u.user_id`
    ).run();

    return { updated: 0 };
  }
}

type D1Database = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => { first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results?: T[] }>; run: () => Promise<unknown> };
  };
};
