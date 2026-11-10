"use client";

import { useQuery } from "@tanstack/react-query";

interface RoleConfig {
  role: string;
  landingPage: string;
  dashboardWidgets: string[];
  fieldLabels: Record<string, string>;
}

export function useFieldLabels() {
  const { data: config } = useQuery<RoleConfig>({
    queryKey: ["role-config-current"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles/current");
      if (!res.ok) throw new Error("Failed to fetch role config");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  function getLabel(fieldName: string, defaultLabel: string): string {
    return config?.fieldLabels?.[fieldName] ?? defaultLabel;
  }

  return { getLabel };
}
