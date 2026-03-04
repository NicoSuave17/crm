import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, deals, tasks, alerts, pipelineStages } from "@/lib/db/schema";
import { eq, and, sql, lte, gte, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const since = searchParams.get("since")
      ? new Date(searchParams.get("since")!)
      : undefined;
    const until = searchParams.get("until")
      ? new Date(searchParams.get("until")!)
      : undefined;
    const pipelineId = searchParams.get("pipelineId") || undefined;

    const isAM = user.role === "account_manager";
    const ownerFilter = isAM ? eq(contacts.ownerId, user.id) : undefined;

    // Build date conditions for contacts
    const contactDateFilters = [];
    if (ownerFilter) contactDateFilters.push(ownerFilter);
    if (since) contactDateFilters.push(gte(contacts.createdAt, since));
    if (until) contactDateFilters.push(lte(contacts.createdAt, until));

    // Build date + pipeline conditions for deals
    const dealDateFilters = [];
    if (isAM) dealDateFilters.push(eq(deals.ownerId, user.id));
    if (since) dealDateFilters.push(gte(deals.createdAt, since));
    if (until) dealDateFilters.push(lte(deals.createdAt, until));
    if (pipelineId) dealDateFilters.push(eq(deals.pipelineId, pipelineId));

    const [
      contactStats,
      gmvStats,
      atRiskCount,
      tasksDueToday,
      dealStats,
      unreadAlerts,
    ] = await Promise.all([
      // Total contacts (scoped by date range)
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(
          contactDateFilters.length > 0
            ? and(...contactDateFilters)
            : undefined
        ),

      // Total GMV under management (current snapshot, not date-scoped)
      db
        .select({
          total: sql<string>`coalesce(sum(cast(${contacts.currentGmv} as numeric)), 0)`,
        })
        .from(contacts)
        .where(
          ownerFilter
            ? and(ownerFilter, eq(contacts.type, "creator"))
            : eq(contacts.type, "creator")
        ),

      // At-risk creators (current state, not date-scoped)
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(
          and(
            ownerFilter,
            eq(contacts.type, "creator"),
            or(
              eq(contacts.churnRisk, "high"),
              eq(contacts.churnRisk, "critical")
            )
          )
        ),

      // Tasks due today or overdue (always current)
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeId, user.id),
            eq(tasks.status, "pending"),
            lte(tasks.dueDate, new Date())
          )
        ),

      // Pipeline stats (scoped by date range + pipeline)
      db
        .select({
          totalValue: sql<string>`coalesce(sum(cast(${deals.value} as numeric)), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(deals)
        .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .where(
          and(
            eq(pipelineStages.isWon, false),
            eq(pipelineStages.isLost, false),
            ...(dealDateFilters.length > 0 ? dealDateFilters : [])
          )
        ),

      // Unread alerts (always current)
      db
        .select({ count: sql<number>`count(*)` })
        .from(alerts)
        .where(and(eq(alerts.userId, user.id), eq(alerts.isRead, false))),
    ]);

    return NextResponse.json({
      totalContacts: Number(contactStats[0].count),
      totalGmv: parseFloat(gmvStats[0].total),
      atRiskCount: Number(atRiskCount[0].count),
      tasksDueToday: Number(tasksDueToday[0].count),
      pipelineValue: parseFloat(dealStats[0].totalValue),
      activeDeals: Number(dealStats[0].count),
      unreadAlerts: Number(unreadAlerts[0].count),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
