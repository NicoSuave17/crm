import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { importJobs, users } from "@/lib/db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { processImportJob } from "@/lib/api/import-processor";

/**
 * POST /api/import-jobs — Create a new import job and start background processing.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { entityType, fileName, rows, customFieldMap, defaultOwnerId } = body;

    if (!entityType || !["contact", "company"].includes(entityType)) {
      return NextResponse.json({ error: "entityType must be 'contact' or 'company'" }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
    }

    // Store rows + optional customFieldMap + defaultOwnerId in payload
    const payload = (customFieldMap || defaultOwnerId)
      ? { rows, customFieldMap, defaultOwnerId }
      : rows;

    // Create the job record
    const [job] = await db
      .insert(importJobs)
      .values({
        userId: user.id,
        entityType,
        fileName: fileName || null,
        payload,
        totalRows: rows.length,
        status: "pending",
      })
      .returning();
    const jobId = job.id;

    // Kick off background processing after response is sent
    after(async () => {
      await processImportJob(jobId);
    });

    return NextResponse.json({ jobId, status: "pending" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/import-jobs error:", errMsg);
    // Don't leak full error details (may contain payload data) to client
    return NextResponse.json({ error: "Failed to create import job" }, { status: 500 });
  }
}

/**
 * GET /api/import-jobs — List import jobs for the current user.
 * Also performs stale job recovery (jobs stuck "processing" > 10 min → mark failed).
 */
export async function GET() {
  try {
    const user = await requireUser();

    // Stale job recovery: mark jobs processing > 10 min as failed
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .update(importJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        results: {
          created: 0,
          skipped: 0,
          updated: 0,
          errors: 1,
          errorDetails: [{ index: -1, message: "Import interrupted — server timeout" }],
        },
      })
      .where(
        and(
          eq(importJobs.status, "processing"),
          lt(importJobs.createdAt, staleThreshold)
        )
      );

    const jobs = await db
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
      .where(eq(importJobs.userId, user.id))
      .orderBy(desc(importJobs.createdAt))
      .limit(50);

    return NextResponse.json({ data: jobs });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/import-jobs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
