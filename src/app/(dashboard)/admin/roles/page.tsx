"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "ae", label: "AE" },
  { value: "enterprise_sales", label: "Enterprise Sales" },
];

interface RoleConfig {
  id?: string;
  role: string;
  landingPage: string;
  defaultPipelineId: string | null;
  dashboardWidgets: unknown[] | null;
  fieldLabels: Record<string, string> | null;
}

export default function RolesPage() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery<RoleConfig[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to fetch role configs");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (config: RoleConfig) => {
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast.success("Role config saved");
    },
    onError: () => toast.error("Failed to save role config"),
  });

  function getConfig(role: string): RoleConfig {
    return (
      configs.find((c) => c.role === role) ?? {
        role,
        landingPage: "/dashboard",
        defaultPipelineId: null,
        dashboardWidgets: null,
        fieldLabels: null,
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Roles</h1>
          <p className="text-sm text-muted-foreground">Configure per-role defaults.</p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-muted-foreground">
          Configure landing pages, default pipelines, and field label overrides per role.
        </p>
      </div>

      <div className="grid gap-4">
        {ROLES.map((role) => (
          <RoleConfigCard
            key={role.value}
            role={role}
            config={getConfig(role.value)}
            onSave={(config) => saveMutation.mutate(config)}
            isPending={saveMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function RoleConfigCard({
  role,
  config,
  onSave,
  isPending,
}: {
  role: { value: string; label: string };
  config: RoleConfig;
  onSave: (config: RoleConfig) => void;
  isPending: boolean;
}) {
  const [landingPage, setLandingPage] = useState(config.landingPage);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{role.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs">Landing Page</Label>
            <Input
              value={landingPage}
              onChange={(e) => setLandingPage(e.target.value)}
              placeholder="/dashboard"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              onSave({
                ...config,
                role: role.value,
                landingPage,
              })
            }
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
