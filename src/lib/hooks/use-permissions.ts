"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-current-user";

type PermissionAction = "create" | "read" | "update" | "delete";

interface PermissionRow {
  role: string;
  entityType: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  recordScope: string;
}

const DEFAULT_PERMISSIONS: Record<
  string,
  { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }
> = {
  admin: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
  manager: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
  account_manager: { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
  ae: { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
  enterprise_sales: { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
};

export function usePermissions() {
  const { user } = useCurrentUser();

  const { data: permissions } = useQuery<PermissionRow[]>({
    queryKey: ["permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  function check(entityType: string, action: PermissionAction): boolean {
    if (!user) return false;
    if (user.role === "admin") return true;

    // Check DB permissions first
    const row = permissions?.find(
      (p) => p.role === user.role && p.entityType === entityType
    );
    if (row) {
      switch (action) {
        case "create":
          return row.canCreate;
        case "read":
          return row.canRead;
        case "update":
          return row.canUpdate;
        case "delete":
          return row.canDelete;
      }
    }

    // Fall back to defaults
    const defaults = DEFAULT_PERMISSIONS[user.role] ?? DEFAULT_PERMISSIONS.ae;
    switch (action) {
      case "create":
        return defaults.canCreate;
      case "read":
        return defaults.canRead;
      case "update":
        return defaults.canUpdate;
      case "delete":
        return defaults.canDelete;
    }
  }

  return {
    canCreate: (entity: string) => check(entity, "create"),
    canRead: (entity: string) => check(entity, "read"),
    canUpdate: (entity: string) => check(entity, "update"),
    canDelete: (entity: string) => check(entity, "delete"),
    isAdmin: user?.role === "admin",
    isAdminOrManager: user?.role === "admin" || user?.role === "manager",
    isLoading: !user,
  };
}
