import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import { adminRoleConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET — all role configs
export async function GET() {
  try {
    await requireRole(["admin"]);
    const rows = await db.select().from(adminRoleConfig);
    return NextResponse.json(rows);
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

// PUT — upsert a role config
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const {
      role,
      landingPage,
      defaultPipelineId,
      dashboardWidgets,
      fieldLabels,
    } = body;

    const [existing] = await db
      .select()
      .from(adminRoleConfig)
      .where(eq(adminRoleConfig.role, role))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(adminRoleConfig)
        .set({
          landingPage,
          defaultPipelineId: defaultPipelineId || null,
          dashboardWidgets,
          fieldLabels,
          updatedAt: new Date(),
        })
        .where(eq(adminRoleConfig.id, existing.id))
        .returning();

      await logAuditEvent(user.id, { action: "update_role_config", entityType: "role_config", entityId: updated.id });

      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(adminRoleConfig)
      .values({
        role,
        landingPage: landingPage || "/dashboard",
        defaultPipelineId: defaultPipelineId || null,
        dashboardWidgets,
        fieldLabels,
      })
      .returning();

    await logAuditEvent(user.id, { action: "create_role_config", entityType: "role_config", entityId: created.id });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PUT /api/admin/roles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
