import { NextResponse } from "next/server";
import { withDetailPermission } from "@/lib/auth/with-permission";
import { getDealWithRelations, getDeal, updateDeal, deleteDeal, ChecklistIncompleteError } from "@/lib/api/deals";
import type { UpdateDealInput } from "@/lib/validators/deal";
import { stripRestrictedFields } from "@/lib/auth/permissions";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withDetailPermission("deal", "read", async (_request, { user, scope, params }) => {
  const deal = await getDealWithRelations(params.id);
  if (!deal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && deal.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to view this deal" }, { status: 403 });
  }

  return NextResponse.json(deal);
});

export const PATCH = withDetailPermission("deal", "update", async (request, { user, scope, params }) => {
  const existing = await getDeal(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to update this deal" }, { status: 403 });
  }

  const body = await request.json();

  // Enforce field-level permissions — strip readonly/hidden fields
  const { cleaned, rejected } = await stripRestrictedFields(
    user.role,
    "deal",
    body as Record<string, unknown>
  );

  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in request", rejectedFields: rejected },
      { status: 403 }
    );
  }

  // Run gatekeeper analysis
  const gk = await gatekeeperCheck({
    source: "form",
    operation: "update",
    entityType: "deal",
    data: cleaned,
    existingRecord: existing as unknown as Record<string, unknown>,
    userId: user.id,
  });
  if (!gk.proceed) return gk.response;

  try {
    const deal = await updateDeal(params.id, gk.data as UpdateDealInput, user.id);
    return NextResponse.json({ ...deal, _rejectedFields: rejected.length > 0 ? rejected : undefined });
  } catch (err) {
    if (err instanceof ChecklistIncompleteError) {
      return NextResponse.json(
        {
          error: "Required checklist items must be completed before changing stages",
          code: "CHECKLIST_INCOMPLETE",
          items: err.items,
        },
        { status: 422 }
      );
    }
    throw err; // Re-throw to let withDetailPermission handle other errors
  }
});

export const DELETE = withDetailPermission("deal", "delete", async (_request, { user, scope, params }) => {
  const existing = await getDeal(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to delete this deal" }, { status: 403 });
  }

  await deleteDeal(params.id, user.id);
  return NextResponse.json({ success: true });
});
