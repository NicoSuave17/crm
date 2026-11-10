import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/helpers";
import {
  getStageChecklists,
  createStageChecklist,
  updateStageChecklist,
  deleteStageChecklist,
} from "@/lib/api/checklists";
import {
  createChecklistSchema,
  updateChecklistSchema,
} from "@/lib/validators/checklist";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireUser();
    const { stageId } = await params;
    const items = await getStageChecklists(stageId);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET stage checklists error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);
    const { stageId } = await params;

    const body = await request.json();
    const parsed = createChecklistSchema.safeParse({ ...body, stageId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await createStageChecklist(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST stage checklist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);

    const body = await request.json();
    const { checklistId, ...updateData } = body;
    if (!checklistId) {
      return NextResponse.json(
        { error: "checklistId is required" },
        { status: 400 }
      );
    }

    const parsed = updateChecklistSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await updateStageChecklist(checklistId, parsed.data);
    if (!item) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH stage checklist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    await requireRole(["admin", "manager"]);

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get("checklistId");
    if (!checklistId) {
      return NextResponse.json(
        { error: "checklistId is required" },
        { status: 400 }
      );
    }

    await deleteStageChecklist(checklistId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("DELETE stage checklist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
