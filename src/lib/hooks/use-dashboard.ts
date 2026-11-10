"use client";

import { useQuery } from "@tanstack/react-query";

export function useDashboard(
  params: {
    since?: string;
    until?: string;
    pipelineId?: string;
  } = {}
) {
  return useQuery({
    queryKey: ["dashboard", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.since) searchParams.set("since", params.since);
      if (params.until) searchParams.set("until", params.until);
      if (params.pipelineId) searchParams.set("pipelineId", params.pipelineId);
      const qs = searchParams.toString();
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000, // 30s polling
  });
}

export function useAlerts(unreadOnly = false) {
  return useQuery({
    queryKey: ["alerts", { unreadOnly }],
    queryFn: async () => {
      const params = unreadOnly ? "?unreadOnly=true" : "";
      const res = await fetch(`/api/alerts${params}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s for new notifications
  });
}
