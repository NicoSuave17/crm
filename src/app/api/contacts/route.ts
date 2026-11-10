import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/with-permission";
import { listContacts, createContact } from "@/lib/api/contacts";
import { createContactSchema } from "@/lib/validators/contact";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withPermission("contact", "read", async (request, { user, scope, teamMemberIds }) => {
  try {
    const { searchParams } = new URL(request.url);

    // Apply record scope from permissions
    let ownerId = searchParams.get("ownerId") || undefined;
    if (!ownerId && scope === "own") {
      ownerId = user.id;
    }
    // For team scope, if no specific ownerId requested, pass team member IDs
    let ownerIds: string[] | undefined;
    if (!ownerId && scope === "team" && teamMemberIds) {
      ownerIds = teamMemberIds;
    }

    const idsOnly = searchParams.get("idsOnly") === "true";

    const params = {
      page: Number(searchParams.get("page")) || 1,
      limit: idsOnly ? 500 : (Number(searchParams.get("limit")) || 25),
      search: searchParams.get("search") || undefined,
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      vertical: searchParams.get("vertical") || undefined,
      ownerId,
      ownerIds,
      companyId: searchParams.get("companyId") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortDir: (searchParams.get("sortDir") as "asc" | "desc") || undefined,
    };

    if (idsOnly) {
      // Fast path: return just IDs for bulk "select all matching"
      params.page = 1;
      const result = await listContacts(params);
      const ids = result.data.map((c: { id: string }) => c.id);
      return NextResponse.json({ ids, total: result.pagination.total });
    }

    const result = await listContacts(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/contacts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

export const POST = withPermission("contact", "create", async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);

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
      entityType: "contact",
      data: parsed.data as Record<string, unknown>,
      userId: user.id,
    });
    if (!gk.proceed) return gk.response;

    // Re-validate with normalized data
    const normalizedParsed = createContactSchema.safeParse(gk.data);
    const contactData = normalizedParsed.success ? normalizedParsed.data : parsed.data;

    const contact = await createContact(contactData, user.id);
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("POST /api/contacts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
