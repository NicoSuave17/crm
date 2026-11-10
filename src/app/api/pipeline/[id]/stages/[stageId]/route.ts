import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { updateStage, deleteStage } from "@/lib/api/pipelines";
import { updateStageSchema } from "@/lib/validators/pipeline";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);
    const { stageId } = await params;

    const body = await request.json();
    const parsed = updateStageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const stage = await updateStage(stageId, parsed.data);
    if (!stage) {
      return NextResponse.json(
        { error: "Stage not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(stage);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/pipeline/[id]/stages/[stageId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);
    const { stageId } = await params;

    await deleteStage(stageId);
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
    if (error instanceof Error && error.message === "Stage not found") {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }
    console.error("DELETE /api/pipeline/[id]/stages/[stageId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
