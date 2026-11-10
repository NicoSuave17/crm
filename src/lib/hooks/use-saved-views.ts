"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSavedViews(entityType?: string) {
  return useQuery({
    queryKey: ["saved-views", entityType],
    queryFn: async () => {
      const params = entityType ? `?entityType=${entityType}` : "";
      const res = await fetch(`/api/saved-views${params}`);
      if (!res.ok) throw new Error("Failed to fetch saved views");
      return res.json();
    },
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      entityType: string;
      filters: Record<string, unknown>[];
      sortBy?: { field: string; direction: "asc" | "desc" }[];
      columns?: string[];
      isShared?: boolean;
    }) => {
      const res = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create view");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  });
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-views/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete view");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  });
}
