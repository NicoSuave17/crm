import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import { adminPermissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET — all permission rows
export async function GET() {
  try {
    await requireRole(["admin"]);

    const rows = await db.select().from(adminPermissions);
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

// PUT — upsert a permission row
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const {
      role,
      entityType,
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      recordScope,
      fieldOverrides,
    } = body;

    // Check if row exists
    const [existing] = await db
      .select()
      .from(adminPermissions)
      .where(
        and(
          eq(adminPermissions.role, role),
          eq(adminPermissions.entityType, entityType)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(adminPermissions)
        .set({
          canCreate,
          canRead,
          canUpdate,
          canDelete,
          recordScope,
          fieldOverrides,
          updatedAt: new Date(),
        })
        .where(eq(adminPermissions.id, existing.id))
        .returning();

      await logAuditEvent(user.id, { action: "update_permission", entityType: "permission", entityId: updated.id });

      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(adminPermissions)
      .values({
        role,
        entityType,
        canCreate,
        canRead,
        canUpdate,
        canDelete,
        recordScope,
        fieldOverrides,
      })
      .returning();

    await logAuditEvent(user.id, { action: "create_permission", entityType: "permission", entityId: created.id });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PUT /api/admin/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
