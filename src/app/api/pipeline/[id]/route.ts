import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/helpers";
import { getPipelineWithStages, updatePipeline, deletePipeline } from "@/lib/api/pipelines";
import { listDealsByPipeline } from "@/lib/api/deals";
import { getDealChecklistProgress } from "@/lib/api/checklists";
import { updatePipelineSchema } from "@/lib/validators/pipeline";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const pipeline = await getPipelineWithStages(id);
    if (!pipeline) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deals = await listDealsByPipeline(id);

    // Attach checklist progress to each deal
    const dealIds = deals.map((d) => d.id);
    const progressMap = await getDealChecklistProgress(dealIds);
    const dealsWithProgress = deals.map((d) => ({
      ...d,
      checklistProgress: progressMap.get(d.id) ?? null,
    }));

    return NextResponse.json({ ...pipeline, deals: dealsWithProgress });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/pipeline/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePipelineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const pipeline = await updatePipeline(id, parsed.data);
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    return NextResponse.json(pipeline);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/pipeline/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await params;
    await deletePipeline(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("DELETE /api/pipeline/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
