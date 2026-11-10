import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { importJobs, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/import-jobs/[id] — Get a single import job with full details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const [job] = await db
      .select({
        id: importJobs.id,
        entityType: importJobs.entityType,
        status: importJobs.status,
        fileName: importJobs.fileName,
        totalRows: importJobs.totalRows,
        processedRows: importJobs.processedRows,
        results: importJobs.results,
        createdAt: importJobs.createdAt,
        completedAt: importJobs.completedAt,
        userName: users.firstName,
        userLastName: users.lastName,
      })
      .from(importJobs)
      .leftJoin(users, eq(importJobs.userId, users.id))
      .where(and(eq(importJobs.id, id), eq(importJobs.userId, user.id)))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/import-jobs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
