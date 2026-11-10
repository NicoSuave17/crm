import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { gatekeeperDecisionLog, gatekeeperReviewQueue } from "@/lib/db/schema";
import { sql, eq, gte, and } from "drizzle-orm";

/**
 * GET /api/gatekeeper/stats
 * Dashboard stats for gatekeeper activity.
 */
export async function GET() {
  try {
    await requireUser();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [decisionsToday, queueDepth, approvedToday, rejectedToday, avgConfidence, totalTokenCost] =
      await Promise.all([
        // Decisions made today
        db
          .select({ count: sql<number>`count(*)` })
          .from(gatekeeperDecisionLog)
          .where(gte(gatekeeperDecisionLog.createdAt, todayStart)),

        // Pending review queue depth
        db
          .select({ count: sql<number>`count(*)` })
          .from(gatekeeperReviewQueue)
          .where(eq(gatekeeperReviewQueue.status, "pending_review")),

        // Approved today
        db
          .select({ count: sql<number>`count(*)` })
          .from(gatekeeperReviewQueue)
          .where(
            and(
              eq(gatekeeperReviewQueue.status, "approved"),
              gte(gatekeeperReviewQueue.reviewedAt, todayStart)
            )
          ),

        // Rejected today
        db
          .select({ count: sql<number>`count(*)` })
          .from(gatekeeperReviewQueue)
          .where(
            and(
              eq(gatekeeperReviewQueue.status, "rejected"),
              gte(gatekeeperReviewQueue.reviewedAt, todayStart)
            )
          ),

        // Average confidence today
        db
          .select({ avg: sql<number>`coalesce(avg(${gatekeeperDecisionLog.confidence}), 0)` })
          .from(gatekeeperDecisionLog)
          .where(gte(gatekeeperDecisionLog.createdAt, todayStart)),

        // Total tokens used today
        db
          .select({ total: sql<number>`coalesce(sum(${gatekeeperDecisionLog.tokensUsed}), 0)` })
          .from(gatekeeperDecisionLog)
          .where(gte(gatekeeperDecisionLog.createdAt, todayStart)),
      ]);

    // Auto-apply rate
    const totalToday = Number(decisionsToday[0].count) || 0;
    const [autoApplyCount] = totalToday > 0
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(gatekeeperDecisionLog)
          .where(
            and(
              eq(gatekeeperDecisionLog.zone, "auto_apply"),
              gte(gatekeeperDecisionLog.createdAt, todayStart)
            )
          )
      : [{ count: 0 }];

    const autoApplyRate = totalToday > 0
      ? Math.round((Number(autoApplyCount.count) / totalToday) * 100)
      : 0;

    return NextResponse.json({
      decisionsToday: totalToday,
      queueDepth: Number(queueDepth[0].count),
      approvedToday: Number(approvedToday[0].count),
      rejectedToday: Number(rejectedToday[0].count),
      avgConfidence: Math.round(Number(avgConfidence[0].avg)),
      autoApplyRate,
      tokensUsedToday: Number(totalTokenCost[0].total),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/gatekeeper/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
