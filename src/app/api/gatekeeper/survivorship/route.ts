import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { gatekeeperSurvivorshipRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

/**
 * GET /api/gatekeeper/survivorship
 * List all survivorship rules.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");

    const rules = entityType
      ? await db
          .select()
          .from(gatekeeperSurvivorshipRules)
          .where(eq(gatekeeperSurvivorshipRules.entityType, entityType as typeof gatekeeperSurvivorshipRules.entityType.enumValues[number]))
      : await db.select().from(gatekeeperSurvivorshipRules);

    return NextResponse.json({ rules });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const updateRulesSchema = z.object({
  rules: z.array(
    z.object({
      entityType: z.enum(["contact", "company", "deal"]),
      field: z.string(),
      strategy: z.enum(["most_recent", "most_complete", "manual", "ai_decide"]),
      aiContext: z.string().nullable().optional(),
      priority: z.number().optional(),
    })
  ),
});

/**
 * PUT /api/gatekeeper/survivorship
 * Update survivorship rules (admin only).
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();

    // Check admin role
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    // Upsert rules
    for (const rule of parsed.data.rules) {
      const existing = await db
        .select({ id: gatekeeperSurvivorshipRules.id })
        .from(gatekeeperSurvivorshipRules)
        .where(
          and(
            eq(gatekeeperSurvivorshipRules.entityType, rule.entityType),
            eq(gatekeeperSurvivorshipRules.field, rule.field)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(gatekeeperSurvivorshipRules)
          .set({
            strategy: rule.strategy,
            aiContext: rule.aiContext ?? null,
            priority: rule.priority ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(gatekeeperSurvivorshipRules.id, existing[0].id));
      } else {
        await db.insert(gatekeeperSurvivorshipRules).values({
          entityType: rule.entityType,
          field: rule.field,
          strategy: rule.strategy,
          aiContext: rule.aiContext ?? null,
          priority: rule.priority ?? 0,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
