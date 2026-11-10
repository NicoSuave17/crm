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

export function useDeals(params: { ownerId?: string; contactId?: string; companyId?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.companyId) searchParams.set("companyId", params.companyId);

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
      const json = await res.json();
      if (res.status === 202) return { ...json, _pendingReview: true };
      if (!res.ok) throw new Error(json.error || "Failed to create deal");
      return json;
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
      if (res.status === 202) {
        const json = await res.json();
        return { ...json, _pendingReview: true };
      }
      if (!res.ok) {
        let body: Record<string, unknown> | null = null;
        try { body = await res.json(); } catch { /* non-JSON response */ }
        if (body?.code === "CHECKLIST_INCOMPLETE") {
          const err = new Error((body.error as string) || "Checklist items incomplete") as Error & {
            code: string;
            items: { id: string; title: string }[];
          };
          err.code = "CHECKLIST_INCOMPLETE";
          err.items = (body.items as { id: string; title: string }[]) ?? [];
          throw err;
        }
        throw new Error((body?.error as string) || "Failed to update deal");
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
