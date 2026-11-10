import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/with-permission";
import { listCompanies, createCompany } from "@/lib/api/companies";
import { createCompanySchema } from "@/lib/validators/company";
import { gatekeeperCheck } from "@/lib/ai/route-helper";

export const GET = withPermission("company", "read", async (request, { user, scope, teamMemberIds }) => {
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

    const idsOnly = searchParams.get("idsOnly") === "true";

    const params = {
      page: Number(searchParams.get("page")) || 1,
      limit: idsOnly ? 500 : (Number(searchParams.get("limit")) || 25),
      search: searchParams.get("search") || undefined,
      industry: searchParams.get("industry") || undefined,
      size: searchParams.get("size") || undefined,
      vertical: searchParams.get("vertical") || undefined,
      ownerId,
      ownerIds,
      tagId: searchParams.get("tagId") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortDir: (searchParams.get("sortDir") as "asc" | "desc") || undefined,
    };

    if (idsOnly) {
      params.page = 1;
      const result = await listCompanies(params);
      const ids = result.data.map((c: { id: string }) => c.id);
      return NextResponse.json({ ids, total: result.pagination.total });
    }

    const result = await listCompanies(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/companies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

export const POST = withPermission("company", "create", async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);

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
      entityType: "company",
      data: parsed.data as Record<string, unknown>,
      userId: user.id,
    });
    if (!gk.proceed) return gk.response;

    const normalizedParsed = createCompanySchema.safeParse(gk.data);
    const companyData = normalizedParsed.success ? normalizedParsed.data : parsed.data;

    const company = await createCompany(companyData, user.id);
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("POST /api/companies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
