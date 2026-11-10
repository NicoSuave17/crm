import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { gatekeeperReviewQueue } from "@/lib/db/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

/**
 * GET /api/gatekeeper/review
 * List pending review items with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending_review";
    const entityType = searchParams.get("entityType");
    const importJobId = searchParams.get("importJobId");
    const page = Number(searchParams.get("page") || "1");
    const limit = Math.min(Number(searchParams.get("limit") || "25"), 100);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (status) {
      conditions.push(eq(gatekeeperReviewQueue.status, status as typeof gatekeeperReviewQueue.status.enumValues[number]));
    }
    if (entityType) {
      conditions.push(eq(gatekeeperReviewQueue.entityType, entityType as typeof gatekeeperReviewQueue.entityType.enumValues[number]));
    }
    if (importJobId) {
      conditions.push(eq(gatekeeperReviewQueue.importJobId, importJobId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(gatekeeperReviewQueue)
        .where(where)
        .orderBy(desc(gatekeeperReviewQueue.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(gatekeeperReviewQueue)
        .where(where),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0].count),
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/gatekeeper/review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const reviewDecisionSchema = z.object({
  reviewId: z.string().uuid(),
  action: z.enum(["approve", "reject", "edit"]),
  editedData: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/gatekeeper/review
 * Submit a review decision (approve/reject/edit).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const parsed = reviewDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { reviewId, action, editedData, notes } = parsed.data;

    // Get the review item
    const [item] = await db
      .select()
      .from(gatekeeperReviewQueue)
      .where(eq(gatekeeperReviewQueue.id, reviewId))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    if (item.status !== "pending_review") {
      return NextResponse.json({ error: "Review item already processed" }, { status: 409 });
    }

    // Update review status
    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "approved";
    await db
      .update(gatekeeperReviewQueue)
      .set({
        status: newStatus as typeof gatekeeperReviewQueue.status.enumValues[number],
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
        ...(editedData ? { normalizedData: editedData } : {}),
      })
      .where(eq(gatekeeperReviewQueue.id, reviewId));

    // On approve: execute the original mutation
    if (action === "approve" || action === "edit") {
      const dataToUse = editedData || (item.normalizedData as Record<string, unknown>) || (item.incomingData as Record<string, unknown>);

      try {
        await executeMutation(item.entityType, item.operation, dataToUse, user.id);
      } catch (error) {
        return NextResponse.json({
          error: "Approved but mutation failed",
          details: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, reviewId, action });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/gatekeeper/review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Execute the original mutation after review approval.
 */
async function executeMutation(
  entityType: string,
  operation: string,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  if (entityType === "contact") {
    if (operation === "create") {
      const { createContact } = await import("@/lib/api/contacts");
      const { createContactSchema } = await import("@/lib/validators/contact");
      const parsed = createContactSchema.parse(data);
      await createContact(parsed, userId);
    } else if (operation === "update" && data._entityId) {
      const { updateContact } = await import("@/lib/api/contacts");
      const entityId = data._entityId as string;
      const { _entityId, ...updateData } = data;
      await updateContact(entityId, updateData, userId);
    }
  } else if (entityType === "company") {
    if (operation === "create") {
      const { createCompany } = await import("@/lib/api/companies");
      const { createCompanySchema } = await import("@/lib/validators/company");
      const parsed = createCompanySchema.parse(data);
      await createCompany(parsed, userId);
    } else if (operation === "update" && data._entityId) {
      const { updateCompany } = await import("@/lib/api/companies");
      const entityId = data._entityId as string;
      const { _entityId, ...updateData } = data;
      await updateCompany(entityId, updateData, userId);
    }
  } else if (entityType === "deal") {
    if (operation === "create") {
      const { createDeal } = await import("@/lib/api/deals");
      const { createDealSchema } = await import("@/lib/validators/deal");
      const parsed = createDealSchema.parse(data);
      await createDeal(parsed, userId);
    } else if (operation === "update" && data._entityId) {
      const { updateDeal } = await import("@/lib/api/deals");
      const entityId = data._entityId as string;
      const { _entityId, ...updateData } = data;
      await updateDeal(entityId, updateData, userId);
    }
  }
}
