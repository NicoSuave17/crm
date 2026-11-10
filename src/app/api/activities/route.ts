import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listActivities, createActivity } from "@/lib/api/activities";
import { calculateHealthScore } from "@/lib/api/health-score";
import { createActivitySchema } from "@/lib/validators/activity";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const params = {
      contactId: searchParams.get("contactId") || undefined,
      dealId: searchParams.get("dealId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
      limit: Number(searchParams.get("limit")) || 50,
      offset: Number(searchParams.get("offset")) || 0,
    };

    const data = await listActivities(params);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const activity = await createActivity(parsed.data, user.id);

    // Trigger health score recalculation for the activity's contact (fire-and-forget)
    if (activity.contactId) {
      calculateHealthScore(activity.contactId).catch((err) =>
        console.error("Health score recalculation failed:", err)
      );
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
