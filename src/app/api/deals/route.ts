import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/with-permission";
import { listDeals, createDeal } from "@/lib/api/deals";
import { createDealSchema } from "@/lib/validators/deal";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withPermission("deal", "read", async (request, { user, scope, teamMemberIds }) => {
  try {
    const { searchParams } = new URL(request.url);

    let ownerId = searchParams.get("ownerId") || undefined;
    if (!ownerId && scope === "own") {
      ownerId = user.id;
    }
    let ownerIds: string[] | undefined;
    if (!ownerId && scope === "team" && teamMemberIds) {
      ownerIds = teamMemberIds;
    }

    const data = await listDeals({
      ownerId,
      ownerIds,
      contactId: searchParams.get("contactId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withPermission("deal", "create", async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = createDealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Run gatekeeper analysis
    const gk = await gatekeeperCheck({
      source: "form",
      operation: "create",
      entityType: "deal",
      data: parsed.data as Record<string, unknown>,
      userId: user.id,
    });
    if (!gk.proceed) return gk.response;

    const normalizedParsed = createDealSchema.safeParse(gk.data);
    const dealData = normalizedParsed.success ? normalizedParsed.data : parsed.data;

    const deal = await createDeal(dealData, user.id);
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("POST /api/deals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
