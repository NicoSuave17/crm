import { db } from "@/lib/db";
import { adminPermissions, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "./helpers";

export type PermissionAction = "create" | "read" | "update" | "delete";
export type FieldAccess = "hidden" | "readonly" | "editable";
export type RecordScope = "all" | "own" | "team";

interface PermissionRow {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  recordScope: RecordScope;
  fieldOverrides: Record<string, FieldAccess> | null;
}

const DEFAULT_PERMISSIONS: Record<UserRole, PermissionRow> = {
  admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    recordScope: "all",
    fieldOverrides: null,
  },
  manager: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    recordScope: "all",
    fieldOverrides: null,
  },
  account_manager: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    recordScope: "own",
    fieldOverrides: null,
  },
  ae: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    recordScope: "own",
    fieldOverrides: null,
  },
  enterprise_sales: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    recordScope: "own",
    fieldOverrides: null,
  },
};

export async function getPermissions(
  role: UserRole,
  entityType: string
): Promise<PermissionRow> {
  const [row] = await db
    .select()
    .from(adminPermissions)
    .where(
      and(
        eq(adminPermissions.role, role),
        eq(adminPermissions.entityType, entityType)
      )
    )
    .limit(1);

  if (row) {
    return {
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      recordScope: row.recordScope as RecordScope,
      fieldOverrides: row.fieldOverrides as Record<string, FieldAccess> | null,
    };
  }

  return DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.ae;
}

export async function checkPermission(
  role: UserRole,
  entityType: string,
  action: PermissionAction
): Promise<boolean> {
  // Admins always have full access
  if (role === "admin") return true;

  const perms = await getPermissions(role, entityType);
  switch (action) {
    case "create":
      return perms.canCreate;
    case "read":
      return perms.canRead;
    case "update":
      return perms.canUpdate;
    case "delete":
      return perms.canDelete;
    default:
      return false;
  }
}

export async function getFieldAccess(
  role: UserRole,
  entityType: string,
  fieldName: string
): Promise<FieldAccess> {
  if (role === "admin") return "editable";

  const perms = await getPermissions(role, entityType);
  return perms.fieldOverrides?.[fieldName] ?? "editable";
}

export async function getRecordScope(
  role: UserRole,
  entityType: string
): Promise<RecordScope> {
  if (role === "admin" || role === "manager") return "all";

  const perms = await getPermissions(role, entityType);
  return perms.recordScope;
}

/**
 * Strip fields that the user's role cannot edit.
 * Removes `hidden` fields entirely and prevents `readonly` fields from being updated.
 * Returns the cleaned payload and a list of rejected field names (for logging/errors).
 */
export async function stripRestrictedFields(
  role: UserRole,
  entityType: string,
  payload: Record<string, unknown>
): Promise<{ cleaned: Record<string, unknown>; rejected: string[] }> {
  if (role === "admin") return { cleaned: payload, rejected: [] };

  const perms = await getPermissions(role, entityType);
  const overrides = perms.fieldOverrides;
  if (!overrides) return { cleaned: payload, rejected: [] };

  const cleaned: Record<string, unknown> = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    const access = overrides[key];
    if (access === "hidden" || access === "readonly") {
      rejected.push(key);
    } else {
      cleaned[key] = value;
    }
  }

  return { cleaned, rejected };
}

/**
 * Get all user IDs that belong to the same team(s) as the given user.
 * Used when recordScope is "team" to expand ownerId filtering.
 */
export async function getTeamMemberIds(userId: string): Promise<string[]> {
  // Get all teams the user belongs to
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  if (userTeams.length === 0) return [userId];

  // Get all members of those teams
  const memberRows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers);

  const teamIds = new Set(userTeams.map((t) => t.teamId));
  // We need to re-query with the team IDs
  const allMembers = new Set<string>([userId]);
  for (const teamId of teamIds) {
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    for (const m of members) {
      allMembers.add(m.userId);
    }
  }

  return Array.from(allMembers);
}
