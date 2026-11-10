import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, activities, users, gmvSnapshots } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // Managers can view any AM's portfolio
    const targetOwnerId = searchParams.get("ownerId") ?? user.id;
    const sortBy = searchParams.get("sortBy") ?? "healthScore";
    const sortDir = searchParams.get("sortDir") ?? "asc";
    const churnRiskFilter = searchParams.get("churnRisk");
    const verticalFilter = searchParams.get("vertical");

    const conditions = [
      eq(contacts.type, "creator"),
      eq(contacts.ownerId, targetOwnerId),
    ];

    if (churnRiskFilter) {
      conditions.push(
        eq(contacts.churnRisk, churnRiskFilter as typeof contacts.churnRisk.enumValues[number])
      );
    }

    if (verticalFilter) {
      conditions.push(
        eq(contacts.vertical, verticalFilter as typeof contacts.vertical.enumValues[number])
      );
    }

    // Get creators with last activity date
    const creators = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        avatarUrl: contacts.avatarUrl,
        whopUsername: contacts.whopUsername,
        status: contacts.status,
        tier: contacts.tier,
        healthScore: contacts.healthScore,
        currentGmv: contacts.currentGmv,
        currentMrr: contacts.currentMrr,
        lifetimeGmv: contacts.lifetimeGmv,
        memberCount: contacts.memberCount,
        churnRisk: contacts.churnRisk,
        vertical: contacts.vertical,
        lastActiveAt: contacts.lastActiveAt,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(
        sortDir === "asc"
          ? sql`${contacts[sortBy as keyof typeof contacts] ?? contacts.healthScore} asc nulls last`
          : sql`${contacts[sortBy as keyof typeof contacts] ?? contacts.healthScore} desc nulls last`
      );

    // Get list of AMs for manager view
    let ams: { id: string; firstName: string; lastName: string }[] = [];
    if (user.role === "manager" || user.role === "admin") {
      ams = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.role, "account_manager"));
    }

    // Aggregate stats
    const totalGmv = creators.reduce(
      (sum, c) => sum + parseFloat(c.currentGmv ?? "0"),
      0
    );
    const avgHealth =
      creators.length > 0
        ? Math.round(
            creators.reduce((sum, c) => sum + (c.healthScore ?? 0), 0) /
              creators.length
          )
        : 0;
    const atRisk = creators.filter(
      (c) => c.churnRisk === "high" || c.churnRisk === "critical"
    ).length;

    // Vertical breakdown
    const verticalBreakdown: { vertical: string; count: number; gmv: number; mrr: number }[] = [];
    const verticalMap = new Map<string, { count: number; gmv: number; mrr: number }>();
    for (const c of creators) {
      const v = c.vertical ?? "unset";
      const existing = verticalMap.get(v) ?? { count: 0, gmv: 0, mrr: 0 };
      existing.count++;
      existing.gmv += parseFloat(c.currentGmv ?? "0");
      existing.mrr += parseFloat(c.currentMrr ?? "0");
      verticalMap.set(v, existing);
    }
    for (const [vertical, d] of verticalMap) {
      verticalBreakdown.push({ vertical, ...d });
    }
    verticalBreakdown.sort((a, b) => b.gmv - a.gmv);

    // Health distribution
    const healthDistribution = [
      { name: "Critical (<25)", value: creators.filter((c) => (c.healthScore ?? 0) < 25).length, color: "#E86644" },
      { name: "Poor (25-50)", value: creators.filter((c) => (c.healthScore ?? 0) >= 25 && (c.healthScore ?? 0) < 50).length, color: "#FA4616" },
      { name: "Fair (50-75)", value: creators.filter((c) => (c.healthScore ?? 0) >= 50 && (c.healthScore ?? 0) < 75).length, color: "#8160CE" },
      { name: "Good (75+)", value: creators.filter((c) => (c.healthScore ?? 0) >= 75).length, color: "#00876D" },
    ];

    // NRR calculation
    let nrr = 100;
    const contactIds = creators.map((c) => c.id);
    if (contactIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

      const oldSnapshots = await db
        .select({ contactId: gmvSnapshots.contactId, mrr: gmvSnapshots.mrr })
        .from(gmvSnapshots)
        .where(and(
          inArray(gmvSnapshots.contactId, contactIds),
          eq(gmvSnapshots.date, dateStr)
        ));

      if (oldSnapshots.length > 0) {
        const previousMrr = oldSnapshots.reduce((sum, s) => sum + parseFloat(s.mrr ?? "0"), 0);
        const currentMrr = creators.reduce((sum, c) => sum + parseFloat(c.currentMrr ?? "0"), 0);
        if (previousMrr > 0) {
          nrr = Math.round((currentMrr / previousMrr) * 100);
        }
      }
    }

    return NextResponse.json({
      creators,
      ams,
      stats: {
        totalCreators: creators.length,
        totalGmv,
        avgHealth,
        atRisk,
        nrr,
      },
      verticalBreakdown,
      healthDistribution,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/portfolio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
