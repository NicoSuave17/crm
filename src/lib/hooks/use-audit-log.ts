"use client";

import { useQuery } from "@tanstack/react-query";

export interface AuditRow {
  id: string;
  action: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  occurredAt: string;
}

export function useAuditLog(params: {
  limit?: number;
  offset?: number;
  entityType?: string;
  userId?: string;
  since?: string;
  until?: string;
} = {}) {
  return useQuery<{ data: AuditRow[]; total: number }>({
    queryKey: ["audit-log", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set("limit", String(params.limit));
      if (params.offset) searchParams.set("offset", String(params.offset));
      if (params.entityType) searchParams.set("entityType", params.entityType);
      if (params.userId) searchParams.set("userId", params.userId);
      if (params.since) searchParams.set("since", params.since);
      if (params.until) searchParams.set("until", params.until);
      const qs = searchParams.toString();
      const res = await fetch(`/api/audit-log${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });
}
