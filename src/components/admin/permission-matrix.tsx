"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ENTITY_TYPES = ["contact", "deal", "company", "task", "activity"];
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "ae", label: "AE" },
  { value: "enterprise_sales", label: "Enterprise Sales" },
];
const ACTIONS = ["canCreate", "canRead", "canUpdate", "canDelete"] as const;
const ACTION_LABELS: Record<string, string> = {
  canCreate: "Create",
  canRead: "Read",
  canUpdate: "Update",
  canDelete: "Delete",
};

interface PermissionRow {
  id?: string;
  role: string;
  entityType: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  recordScope: string;
}

interface PermissionMatrixProps {
  initialData: PermissionRow[];
}

export function PermissionMatrix({ initialData }: PermissionMatrixProps) {
  const [permissions, setPermissions] = useState<
    Map<string, PermissionRow>
  >(() => {
    const map = new Map();
    for (const row of initialData) {
      map.set(`${row.role}:${row.entityType}`, row);
    }
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);

  function getPermission(role: string, entityType: string): PermissionRow {
    return (
      permissions.get(`${role}:${entityType}`) ?? {
        role,
        entityType,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: role === "admin" || role === "manager",
        recordScope: role === "admin" || role === "manager" ? "all" : "own",
      }
    );
  }

  function updatePermission(
    role: string,
    entityType: string,
    updates: Partial<PermissionRow>
  ) {
    const key = `${role}:${entityType}`;
    const current = getPermission(role, entityType);
    setPermissions((prev) => {
      const next = new Map(prev);
      next.set(key, { ...current, ...updates });
      return next;
    });
  }

  async function savePermission(role: string, entityType: string) {
    const key = `${role}:${entityType}`;
    setSaving(key);
    try {
      const perm = getPermission(role, entityType);
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perm),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      setPermissions((prev) => {
        const next = new Map(prev);
        next.set(key, saved);
        return next;
      });
      toast.success(`Saved ${role} / ${entityType}`);
    } catch {
      toast.error("Failed to save permission");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-8">
      {ENTITY_TYPES.map((entityType) => (
        <div key={entityType} className="space-y-3">
          <h3 className="text-sm font-semibold capitalize">{entityType}s</h3>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  {ACTIONS.map((action) => (
                    <th
                      key={action}
                      className="text-center px-3 py-2 font-medium"
                    >
                      {ACTION_LABELS[action]}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => {
                  const perm = getPermission(role.value, entityType);
                  const key = `${role.value}:${entityType}`;
                  return (
                    <tr key={role.value} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{role.label}</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="text-center px-3 py-2">
                          <Checkbox
                            checked={perm[action]}
                            disabled={role.value === "admin"}
                            onCheckedChange={(checked) =>
                              updatePermission(role.value, entityType, {
                                [action]: !!checked,
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="text-center px-3 py-2">
                        <Select
                          value={perm.recordScope}
                          disabled={role.value === "admin"}
                          onValueChange={(v) =>
                            updatePermission(role.value, entityType, {
                              recordScope: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="own">Own</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={saving === key || role.value === "admin"}
                          onClick={() =>
                            savePermission(role.value, entityType)
                          }
                        >
                          {saving === key ? "Saving..." : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
