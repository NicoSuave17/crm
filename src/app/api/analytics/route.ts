import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, deals, activities, pipelineStages, tasks } from "@/lib/db/schema";
import { eq, sql, count, and, gte, lte } from "drizzle-orm";

export async function GET() {
  try {
    await requireUser();

    // Contact breakdown by type
    const contactsByType = await db
      .select({
        type: contacts.type,
        count: count(),
      })
      .from(contacts)
      .groupBy(contacts.type);

    // Contact breakdown by status
    const contactsByStatus = await db
      .select({
        status: contacts.status,
        count: count(),
      })
      .from(contacts)
      .groupBy(contacts.status);

    // Deal pipeline conversion - deals per stage
    const dealsByStage = await db
      .select({
        stageName: pipelineStages.name,
        stageColor: pipelineStages.color,
        count: count(),
        totalValue: sql<string>`coalesce(sum(${deals.value}::numeric), 0)`,
      })
      .from(deals)
      .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .groupBy(pipelineStages.name, pipelineStages.color, pipelineStages.position)
      .orderBy(pipelineStages.position);

    // Activity breakdown by type (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activitiesByType = await db
      .select({
        type: activities.type,
        count: count(),
      })
      .from(activities)
      .where(gte(activities.occurredAt, thirtyDaysAgo))
      .groupBy(activities.type);

    // Tasks summary
    const tasksSummary = await db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.status);

    // Monthly activity trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const activityTrend = await db
      .select({
        month: sql<string>`to_char(${activities.occurredAt}, 'YYYY-MM')`,
        count: count(),
      })
      .from(activities)
      .where(gte(activities.occurredAt, sixMonthsAgo))
      .groupBy(sql`to_char(${activities.occurredAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${activities.occurredAt}, 'YYYY-MM')`);

    return NextResponse.json({
      contactsByType,
      contactsByStatus,
      dealsByStage,
      activitiesByType,
      tasksSummary,
      activityTrend,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
