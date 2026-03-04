import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { getDealWithRelations, updateDeal, deleteDeal, moveDeal } from "@/lib/api/deals";
import { updateDealSchema, moveDealSchema } from "@/lib/validators/deal";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const deal = await getDealWithRelations(id);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    // Check if this is a stage move
    const moveResult = moveDealSchema.safeParse(body);
    if (moveResult.success && Object.keys(body).length === 1) {
      const deal = await moveDeal(id, moveResult.data.stageId, user.id);
      if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(deal);
    }

    // Regular update
    const parsed = updateDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const deal = await updateDeal(id, parsed.data, user.id);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    await deleteDeal(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
