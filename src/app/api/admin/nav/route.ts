import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import {
  adminNavItems,
  adminNavRoleAccess,
  userRoleEnum,
} from "@/lib/db/schema";
import { eq, asc, inArray, sql } from "drizzle-orm";
import { DEFAULT_NAV_ITEMS } from "@/lib/constants/default-nav";

const ALL_ROLES = userRoleEnum.enumValues;

// GET — returns nav items for the current user's role
export async function GET() {
  try {
    const user = await requireUser();

    // Auto-seed if table is empty
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminNavItems);

    if (Number(countResult.count) === 0) {
      // Seed default nav items
      for (const item of DEFAULT_NAV_ITEMS) {
        const [inserted] = await db
          .insert(adminNavItems)
          .values({
            label: item.label,
            icon: item.icon,
            href: item.href,
            section: item.section,
            position: item.position,
            entityType: item.entityType,
            isSystem: true,
          })
          .returning();

        // Grant access to all roles
        await db.insert(adminNavRoleAccess).values(
          ALL_ROLES.map((role) => ({ navItemId: inserted.id, role }))
        );
      }
    }

    // Get nav item IDs accessible to this role
    const roleAccessRows = await db
      .select({ navItemId: adminNavRoleAccess.navItemId })
      .from(adminNavRoleAccess)
      .where(eq(adminNavRoleAccess.role, user.role));

    const accessibleIds = roleAccessRows.map((r) => r.navItemId);

    if (accessibleIds.length === 0) {
      return NextResponse.json([]);
    }

    const items = await db
      .select()
      .from(adminNavItems)
      .where(inArray(adminNavItems.id, accessibleIds))
      .orderBy(asc(adminNavItems.section), asc(adminNavItems.position));

    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/admin/nav error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — create a new nav item (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const { label, icon, href, section, position, parentId, savedViewId, entityType, roles } = body;

    const [item] = await db
      .insert(adminNavItems)
      .values({
        label,
        icon: icon || "Circle",
        href,
        section: section || "main",
        position: position ?? 0,
        parentId: parentId || null,
        savedViewId: savedViewId || null,
        entityType: entityType || null,
        isSystem: false,
      })
      .returning();

    // Insert role access entries
    if (roles && Array.isArray(roles) && roles.length > 0) {
      await db.insert(adminNavRoleAccess).values(
        roles.map((role: string) => ({
          navItemId: item.id,
          role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
        }))
      );
    }

    await logAuditEvent(user.id, { action: "create_nav_item", entityType: "nav_item", entityId: item.id });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/nav error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT — update a nav item (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const { id, label, icon, href, section, position, parentId, savedViewId, entityType, roles } = body;

    const [updated] = await db
      .update(adminNavItems)
      .set({
        label,
        icon,
        href,
        section,
        position,
        parentId: parentId || null,
        savedViewId: savedViewId || null,
        entityType: entityType || null,
      })
      .where(eq(adminNavItems.id, id))
      .returning();

    // Replace role access
    if (roles && Array.isArray(roles)) {
      await db
        .delete(adminNavRoleAccess)
        .where(eq(adminNavRoleAccess.navItemId, id));

      if (roles.length > 0) {
        await db.insert(adminNavRoleAccess).values(
          roles.map((role: string) => ({
            navItemId: id,
            role: role as "admin" | "manager" | "account_manager" | "ae" | "enterprise_sales",
          }))
        );
      }
    }

    await logAuditEvent(user.id, { action: "update_nav_item", entityType: "nav_item", entityId: id });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PUT /api/admin/nav error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — delete a nav item (admin only, non-system only)
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Check if system item
    const [item] = await db
      .select()
      .from(adminNavItems)
      .where(eq(adminNavItems.id, id))
      .limit(1);

    if (item?.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system navigation items" },
        { status: 403 }
      );
    }

    await db.delete(adminNavItems).where(eq(adminNavItems.id, id));

    await logAuditEvent(user.id, { action: "delete_nav_item", entityType: "nav_item", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("DELETE /api/admin/nav error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
