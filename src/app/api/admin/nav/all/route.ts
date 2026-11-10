import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { adminNavItems, adminNavRoleAccess } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

// GET — returns ALL nav items with their role access (admin only)
export async function GET() {
  try {
    await requireRole(["admin"]);

    const items = await db
      .select()
      .from(adminNavItems)
      .orderBy(asc(adminNavItems.section), asc(adminNavItems.position));

    const roleRows = await db.select().from(adminNavRoleAccess);

    const rolesByItem = new Map<string, string[]>();
    for (const r of roleRows) {
      const existing = rolesByItem.get(r.navItemId) ?? [];
      existing.push(r.role);
      rolesByItem.set(r.navItemId, existing);
    }

    const result = items.map((item) => ({
      ...item,
      roles: rolesByItem.get(item.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/nav/all error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
