import { NextResponse } from "next/server";
import { withDetailPermission } from "@/lib/auth/with-permission";
import { getCompany, updateCompany, deleteCompany } from "@/lib/api/companies";
import { updateCompanySchema } from "@/lib/validators/company";
import { stripRestrictedFields } from "@/lib/auth/permissions";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withDetailPermission("company", "read", async (_request, { user, scope, params }) => {
  const company = await getCompany(params.id);
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && company.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to view this company" }, { status: 403 });
  }

  return NextResponse.json(company);
});

export const PATCH = withDetailPermission("company", "update", async (request, { user, scope, params }) => {
  const existing = await getCompany(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to update this company" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Enforce field-level permissions — strip readonly/hidden fields
  const { cleaned, rejected } = await stripRestrictedFields(
    user.role,
    "company",
    parsed.data as Record<string, unknown>
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
    entityType: "company",
    data: cleaned,
    existingRecord: existing as unknown as Record<string, unknown>,
    userId: user.id,
  });
  if (!gk.proceed) return gk.response;

  const company = await updateCompany(params.id, gk.data, user.id);
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...company, _rejectedFields: rejected.length > 0 ? rejected : undefined });
});

export const DELETE = withDetailPermission("company", "delete", async (_request, { user, scope, params }) => {
  const existing = await getCompany(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to delete this company" }, { status: 403 });
  }

  await deleteCompany(params.id, user.id);
  return NextResponse.json({ success: true });
});
