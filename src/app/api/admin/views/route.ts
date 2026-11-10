import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import { savedViews, savedViewRoleAccess } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET — all admin views (admin only)
export async function GET() {
  try {
    await requireRole(["admin"]);

    const views = await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.isAdminView, true));

    const roleRows = await db.select().from(savedViewRoleAccess);
    const rolesByView = new Map<string, string[]>();
    for (const r of roleRows) {
      const existing = rolesByView.get(r.savedViewId) ?? [];
      existing.push(r.role);
      rolesByView.set(r.savedViewId, existing);
    }

    const result = views.map((v) => ({
      ...v,
      roles: rolesByView.get(v.id) ?? [],
    }));

    return NextResponse.json(result);
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

// POST — create an admin view
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const {
      name,
      entityType,
      filters,
      sortBy,
      columns,
      columnWidths,
      groupBy,
      showInSidebar,
      roles,
    } = body;

    const [view] = await db
      .insert(savedViews)
      .values({
        name,
        entityType,
        filters: filters ?? [],
        sortBy,
        columns,
        columnWidths,
        groupBy,
        userId: user.id,
        isAdminView: true,
        showInSidebar: showInSidebar ?? false,
      })
      .returning();

    // Insert role access
    if (roles && Array.isArray(roles) && roles.length > 0) {
      await db.insert(savedViewRoleAccess).values(
        roles.map((role: string) => ({
          savedViewId: view.id,
          role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
        }))
      );
    }

    await logAuditEvent(user.id, { action: "create_admin_view", entityType: "admin_view", entityId: view.id });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/views error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT — update an admin view
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const {
      id,
      name,
      filters,
      sortBy,
      columns,
      columnWidths,
      groupBy,
      showInSidebar,
      roles,
    } = body;

    const [updated] = await db
      .update(savedViews)
      .set({
        name,
        filters,
        sortBy,
        columns,
        columnWidths,
        groupBy,
        showInSidebar,
        updatedAt: new Date(),
      })
      .where(eq(savedViews.id, id))
      .returning();

    // Replace role access
    if (roles && Array.isArray(roles)) {
      await db
        .delete(savedViewRoleAccess)
        .where(eq(savedViewRoleAccess.savedViewId, id));

      if (roles.length > 0) {
        await db.insert(savedViewRoleAccess).values(
          roles.map((role: string) => ({
            savedViewId: id,
            role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
          }))
        );
      }
    }

    await logAuditEvent(user.id, { action: "update_admin_view", entityType: "admin_view", entityId: id });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PUT /api/admin/views error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete an admin view
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db.delete(savedViews).where(eq(savedViews.id, id));

    await logAuditEvent(user.id, { action: "delete_admin_view", entityType: "admin_view", entityId: id });

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
