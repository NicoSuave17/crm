import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { findDuplicateCompanies } from "@/lib/api/duplicates";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const domain = searchParams.get("domain");
    const excludeId = searchParams.get("excludeId");

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const duplicates = await findDuplicateCompanies({
      name,
      domain: domain || undefined,
      excludeId: excludeId || undefined,
    });

    return NextResponse.json({ duplicates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
