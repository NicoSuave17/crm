"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateDealInput } from "@/lib/validators/deal";

export function useDeal(id: string) {
  return useQuery({
    queryKey: ["deals", id],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${id}`);
      if (!res.ok) throw new Error("Failed to fetch deal");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDeals(params: { ownerId?: string; contactId?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.contactId) searchParams.set("contactId", params.contactId);

  return useQuery({
    queryKey: ["deals", params],
    queryFn: async () => {
      const res = await fetch(`/api/deals?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDealInput) => {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update deal");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useStageHistory(dealId: string) {
  return useQuery({
    queryKey: ["deals", dealId, "stage-history"],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/history`);
      if (!res.ok) throw new Error("Failed to fetch stage history");
      return res.json();
    },
    enabled: !!dealId,
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
