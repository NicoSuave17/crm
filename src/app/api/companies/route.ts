import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listCompanies, createCompany } from "@/lib/api/companies";
import { createCompanySchema } from "@/lib/validators/company";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // AMs and AEs only see their own companies unless explicitly filtered
    let ownerId = searchParams.get("ownerId") || undefined;
    if (!ownerId && (user.role === "account_manager" || user.role === "ae")) {
      ownerId = user.id;
    }

    const params = {
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 25,
      search: searchParams.get("search") || undefined,
      industry: searchParams.get("industry") || undefined,
      size: searchParams.get("size") || undefined,
      ownerId,
      sortBy: searchParams.get("sortBy") || undefined,
      sortDir: (searchParams.get("sortDir") as "asc" | "desc") || undefined,
    };

    const result = await listCompanies(params);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/companies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const company = await createCompany(parsed.data);
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/companies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
