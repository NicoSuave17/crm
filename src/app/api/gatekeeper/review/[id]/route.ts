import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { gatekeeperReviewQueue, gatekeeperDecisionLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/gatekeeper/review/:id
 * Full review detail with AI analysis.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();

    const { id } = await params;

    const [item] = await db
      .select()
      .from(gatekeeperReviewQueue)
      .where(eq(gatekeeperReviewQueue.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    // Also get the decision log entry
    const [decision] = await db
      .select()
      .from(gatekeeperDecisionLog)
      .where(eq(gatekeeperDecisionLog.decisionId, item.decisionId))
      .limit(1);

    return NextResponse.json({
      review: item,
      decision: decision || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/gatekeeper/review/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
