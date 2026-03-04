"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateActivityInput, UpdateActivityInput } from "@/lib/validators/activity";

export function useActivities(params: { contactId?: string; dealId?: string; companyId?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.dealId) searchParams.set("dealId", params.dealId);
  if (params.companyId) searchParams.set("companyId", params.companyId);

  return useQuery({
    queryKey: ["activities", params],
    queryFn: async () => {
      const res = await fetch(`/api/activities?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!(params.contactId || params.dealId || params.companyId),
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateActivityInput) => {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateActivityInput }) => {
      const res = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
