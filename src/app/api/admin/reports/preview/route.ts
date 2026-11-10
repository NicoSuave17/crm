import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { executeReport } from "@/lib/admin/report-engine";
import { reportConfigSchema } from "@/lib/validators/report";

// POST — execute an unsaved report config for preview
export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin"]);

    const body = await request.json();
    const parsed = reportConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid report config", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await executeReport(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/reports/preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
