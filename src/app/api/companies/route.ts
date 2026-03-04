import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listCompanies } from "@/lib/api/companies";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const data = await listCompanies({
      search: searchParams.get("search") || undefined,
      limit: Number(searchParams.get("limit")) || 100,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/companies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
