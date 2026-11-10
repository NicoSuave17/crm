"use client";

import { useQuery } from "@tanstack/react-query";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { Skeleton } from "@/components/ui/skeleton";

export default function PermissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Configure CRUD permissions and record scope per role and entity type.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <PermissionMatrix initialData={data ?? []} />
      )}
    </div>
  );
}
