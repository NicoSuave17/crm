import { db } from "@/lib/db";
import { contacts, activities, gmvSnapshots } from "@/lib/db/schema";
import { eq, gte, desc, sql, and } from "drizzle-orm";

interface HealthFactors {
  gmvTrend: number; // -100 to +100 (% change 30d vs 60d)
  activityRecency: number; // days since last AM interaction
  memberGrowth: number; // % member change last 30d
  currentGmv: number;
}

const WEIGHTS = {
  gmvTrend: 0.35,
  activityRecency: 0.25,
  memberGrowth: 0.2,
  absoluteGmv: 0.2,
};

/**
 * Calculate health score (0-100) from raw factors.
 */
export function calculateHealthScore(factors: HealthFactors): number {
  // GMV trend score: +20% = 100, 0% = 60, -20% = 0
  const gmvScore = Math.max(0, Math.min(100, 60 + factors.gmvTrend * 2));

  // Activity recency: 0 days = 100, 7 days = 70, 14 days = 40, 30+ days = 0
  const activityScore =
    factors.activityRecency <= 0
      ? 100
      : factors.activityRecency <= 7
        ? 100 - (factors.activityRecency / 7) * 30
        : factors.activityRecency <= 14
          ? 70 - ((factors.activityRecency - 7) / 7) * 30
          : factors.activityRecency <= 30
            ? 40 - ((factors.activityRecency - 14) / 16) * 40
            : 0;

  // Member growth: +10% = 100, 0% = 50, -10% = 0
  const memberScore = Math.max(0, Math.min(100, 50 + factors.memberGrowth * 5));

  // Absolute GMV score: $100K+ = 100, $50K = 75, $10K = 50, $1K = 25, $0 = 0
  const gmvAbsolute = factors.currentGmv;
  const absoluteScore =
    gmvAbsolute >= 100000
      ? 100
      : gmvAbsolute >= 50000
        ? 75 + ((gmvAbsolute - 50000) / 50000) * 25
        : gmvAbsolute >= 10000
          ? 50 + ((gmvAbsolute - 10000) / 40000) * 25
          : gmvAbsolute >= 1000
            ? 25 + ((gmvAbsolute - 1000) / 9000) * 25
            : (gmvAbsolute / 1000) * 25;

  const score = Math.round(
    gmvScore * WEIGHTS.gmvTrend +
      activityScore * WEIGHTS.activityRecency +
      memberScore * WEIGHTS.memberGrowth +
      absoluteScore * WEIGHTS.absoluteGmv
  );

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine churn risk level from health score.
 */
export function getChurnRisk(
  healthScore: number
): "low" | "medium" | "high" | "critical" {
  if (healthScore >= 70) return "low";
  if (healthScore >= 50) return "medium";
  if (healthScore >= 30) return "high";
  return "critical";
}

/**
 * Recalculate health scores for all active creators.
 * Designed to run as a daily cron job.
 */
export async function recalculateAllHealthScores() {
  const activeCreators = await db
    .select({ id: contacts.id, currentGmv: contacts.currentGmv, memberCount: contacts.memberCount })
    .from(contacts)
    .where(
      and(
        eq(contacts.type, "creator"),
        eq(contacts.status, "active")
      )
    );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  let updated = 0;

  for (const creator of activeCreators) {
    // Get GMV snapshots for trend
    const recentSnapshots = await db
      .select({ gmv: gmvSnapshots.gmv, memberCount: gmvSnapshots.memberCount, date: gmvSnapshots.date })
      .from(gmvSnapshots)
      .where(
        and(
          eq(gmvSnapshots.contactId, creator.id),
          gte(gmvSnapshots.date, sixtyDaysAgo.toISOString().split("T")[0])
        )
      )
      .orderBy(desc(gmvSnapshots.date));

    // Calculate GMV trend
    const recentGmv = recentSnapshots.filter(
      (s) => new Date(s.date) >= thirtyDaysAgo
    );
    const olderGmv = recentSnapshots.filter(
      (s) => new Date(s.date) < thirtyDaysAgo
    );

    const avgRecent =
      recentGmv.length > 0
        ? recentGmv.reduce((sum, s) => sum + parseFloat(s.gmv), 0) / recentGmv.length
        : parseFloat(creator.currentGmv ?? "0");

    const avgOlder =
      olderGmv.length > 0
        ? olderGmv.reduce((sum, s) => sum + parseFloat(s.gmv), 0) / olderGmv.length
        : avgRecent;

    const gmvTrend =
      avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;

    // Get last AM activity
    const [lastActivity] = await db
      .select({ occurredAt: activities.occurredAt })
      .from(activities)
      .where(eq(activities.contactId, creator.id))
      .orderBy(desc(activities.occurredAt))
      .limit(1);

    const activityRecency = lastActivity
      ? (now.getTime() - new Date(lastActivity.occurredAt).getTime()) /
        (24 * 60 * 60 * 1000)
      : 30;

    // Member growth from snapshots
    const oldestMemberCount =
      recentGmv.length > 0
        ? recentGmv[recentGmv.length - 1].memberCount ?? creator.memberCount ?? 0
        : creator.memberCount ?? 0;
    const currentMemberCount = creator.memberCount ?? 0;
    const memberGrowth =
      oldestMemberCount > 0
        ? ((currentMemberCount - oldestMemberCount) / oldestMemberCount) * 100
        : 0;

    const healthScore = calculateHealthScore({
      gmvTrend,
      activityRecency,
      memberGrowth,
      currentGmv: parseFloat(creator.currentGmv ?? "0"),
    });

    const churnRisk = getChurnRisk(healthScore);

    await db
      .update(contacts)
      .set({ healthScore, churnRisk, updatedAt: new Date() })
      .where(eq(contacts.id, creator.id));

    updated++;
  }

  return { updated };
}
