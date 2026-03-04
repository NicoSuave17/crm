import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { removeTagFromDeal } from "@/lib/api/tags";

export async function DELETE(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    if (!body.dealId || !body.tagId) {
      return NextResponse.json(
        { error: "dealId and tagId required" },
        { status: 400 }
      );
    }

    await removeTagFromDeal(body.dealId, body.tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
