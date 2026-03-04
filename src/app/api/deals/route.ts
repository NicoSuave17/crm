import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listDeals, createDeal } from "@/lib/api/deals";
import { createDealSchema } from "@/lib/validators/deal";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // AMs and AEs only see their own deals
    let ownerId = searchParams.get("ownerId") || undefined;
    if (!ownerId && (user.role === "account_manager" || user.role === "ae")) {
      ownerId = user.id;
    }

    const data = await listDeals({
      ownerId,
      contactId: searchParams.get("contactId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/deals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createDealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const deal = await createDeal(parsed.data, user.id);
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/deals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
