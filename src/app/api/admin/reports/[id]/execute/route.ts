import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { adminReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeReport } from "@/lib/admin/report-engine";
import { reportConfigSchema } from "@/lib/validators/report";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();

    const { id } = await params;

    // Fetch the report
    const [report] = await db
      .select()
      .from(adminReports)
      .where(eq(adminReports.id, id))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Parse stored config
    const config = reportConfigSchema.parse(report.config);

    // Apply any runtime filter overrides from the request body
    const body = await request.json().catch(() => ({}));
    if (body.filterOverrides) {
      // Merge runtime filters into existing filters
      if (config.filters) {
        config.filters.conditions.push(...(body.filterOverrides.conditions ?? []));
      } else if (body.filterOverrides.conditions?.length > 0) {
        config.filters = body.filterOverrides;
      }
    }

    const result = await executeReport(config);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/admin/reports/[id]/execute error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
