import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listAuditLog } from "@/lib/api/audit-log";
import { queryAuditLog } from "@/lib/api/record-audit";
import { getPermissions } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // Check audit_log permission for the user's role
    // Default: admin/manager get "all", others get "none"
    const perms = await getAuditLogAccess(user.role);
    if (perms === "none") {
      return NextResponse.json({ error: "You don't have permission to view the audit log" }, { status: 403 });
    }

    const source = searchParams.get("source") as "legacy" | "new" | null;

    // Support both the legacy activities-based log and the new dedicated audit_log table
    if (source === "new" || !source) {
      const result = await queryAuditLog({
        limit: Number(searchParams.get("limit")) || 50,
        offset: Number(searchParams.get("offset")) || 0,
        entityType: searchParams.get("entityType") || undefined,
        entityId: searchParams.get("entityId") || undefined,
        action: searchParams.get("action") || undefined,
        userId: searchParams.get("userId") || undefined,
        since: searchParams.get("since") ? new Date(searchParams.get("since")!) : undefined,
        until: searchParams.get("until") ? new Date(searchParams.get("until")!) : undefined,
        ownerScope: perms === "own" ? "own" : "all",
        scopeUserId: perms === "own" ? user.id : undefined,
      });

      return NextResponse.json(result);
    }

    // Legacy fallback
    const result = await listAuditLog({
      limit: Number(searchParams.get("limit")) || 50,
      offset: Number(searchParams.get("offset")) || 0,
      entityType: searchParams.get("entityType") || undefined,
      userId: searchParams.get("userId") || undefined,
      since: searchParams.get("since") ? new Date(searchParams.get("since")!) : undefined,
      until: searchParams.get("until") ? new Date(searchParams.get("until")!) : undefined,
    });

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

/**
 * Get audit log access level for a role.
 * Checks adminPermissions for entityType="audit_log".
 * Defaults: admin/manager -> "all", others -> "none"
 */
async function getAuditLogAccess(role: string): Promise<"all" | "own" | "none"> {
  // Admins always have full access
  if (role === "admin") return "all";

  try {
    const perms = await getPermissions(role as Parameters<typeof getPermissions>[0], "audit_log");
    if (perms.canRead) {
      return perms.recordScope === "own" ? "own" : "all";
    }
    return "none";
  } catch {
    // Default fallback: managers get access, others don't
    return role === "manager" ? "all" : "none";
  }
}
