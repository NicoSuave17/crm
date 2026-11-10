import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import {
  adminReports,
  adminReportRoleAccess,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createReportSchema } from "@/lib/validators/report";

// GET — list reports accessible to current user
export async function GET() {
  try {
    const user = await requireUser();

    if (user.role === "admin") {
      // Admins see all reports
      const reports = await db.select().from(adminReports);
      return NextResponse.json(reports);
    }

    // Get reports shared to this role
    const roleAccessRows = await db
      .select({ reportId: adminReportRoleAccess.reportId })
      .from(adminReportRoleAccess)
      .where(eq(adminReportRoleAccess.role, user.role));

    const reportIds = roleAccessRows.map((r) => r.reportId);

    if (reportIds.length === 0) {
      return NextResponse.json([]);
    }

    const reports = await db
      .select()
      .from(adminReports)
      .where(inArray(adminReports.id, reportIds));

    return NextResponse.json(reports);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a report (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, reportType, format, config, isShared, roles } = parsed.data;

    const [report] = await db
      .insert(adminReports)
      .values({
        name,
        description,
        reportType,
        format,
        config: config as Record<string, unknown>,
        createdBy: user.id,
        isShared,
      })
      .returning();

    // Insert role access
    if (roles && roles.length > 0) {
      await db.insert(adminReportRoleAccess).values(
        roles.map((role) => ({
          reportId: report.id,
          role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
        }))
      );
    }

    await logAuditEvent(user.id, { action: "create_report", entityType: "report", entityId: report.id });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update a report
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const { id, name, description, config, format, isShared, roles } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (config !== undefined) updates.config = config;
    if (format !== undefined) updates.format = format;
    if (isShared !== undefined) updates.isShared = isShared;

    const [updated] = await db
      .update(adminReports)
      .set(updates)
      .where(eq(adminReports.id, id))
      .returning();

    if (roles && Array.isArray(roles)) {
      await db
        .delete(adminReportRoleAccess)
        .where(eq(adminReportRoleAccess.reportId, id));

      if (roles.length > 0) {
        await db.insert(adminReportRoleAccess).values(
          roles.map((role: string) => ({
            reportId: id,
            role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
          }))
        );
      }
    }

    await logAuditEvent(user.id, { action: "update_report", entityType: "report", entityId: id });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/admin/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete a report
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db.delete(adminReports).where(eq(adminReports.id, id));

    await logAuditEvent(user.id, { action: "delete_report", entityType: "report", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
