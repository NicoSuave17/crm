import { NextResponse } from "next/server";
import { withDetailPermission } from "@/lib/auth/with-permission";
import { getContact, updateContact, deleteContact } from "@/lib/api/contacts";
import { updateContactSchema } from "@/lib/validators/contact";
import { stripRestrictedFields } from "@/lib/auth/permissions";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withDetailPermission("contact", "read", async (_request, { user, scope, params }) => {
  const contact = await getContact(params.id);
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && contact.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to view this contact" }, { status: 403 });
  }

  return NextResponse.json(contact);
});

export const PATCH = withDetailPermission("contact", "update", async (request, { user, scope, params }) => {
  const existing = await getContact(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to update this contact" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Enforce field-level permissions — strip readonly/hidden fields
  const { cleaned, rejected } = await stripRestrictedFields(
    user.role,
    "contact",
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
    entityType: "contact",
    data: cleaned,
    existingRecord: existing as unknown as Record<string, unknown>,
    userId: user.id,
  });
  if (!gk.proceed) return gk.response;

  const contact = await updateContact(params.id, gk.data, user.id);
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...contact, _rejectedFields: rejected.length > 0 ? rejected : undefined });
});

export const DELETE = withDetailPermission("contact", "delete", async (_request, { user, scope, params }) => {
  const existing = await getContact(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to delete this contact" }, { status: 403 });
  }

  await deleteContact(params.id, user.id);
  return NextResponse.json({ success: true });
});
