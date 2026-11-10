"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ReviewFilters {
  status?: string;
  entityType?: string;
  importJobId?: string;
  page?: number;
  limit?: number;
}

export function useReviewQueue(filters: ReviewFilters = {}) {
  const { status = "pending_review", entityType, importJobId, page = 1, limit = 25 } = filters;

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (entityType) params.set("entityType", entityType);
  if (importJobId) params.set("importJobId", importJobId);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return useQuery({
    queryKey: ["gatekeeper-review", status, entityType, importJobId, page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/gatekeeper/review?${params}`);
      if (!res.ok) throw new Error("Failed to fetch review queue");
      return res.json();
    },
  });
}

export function useReviewItem(id: string | null) {
  return useQuery({
    queryKey: ["gatekeeper-review-item", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/gatekeeper/review/${id}`);
      if (!res.ok) throw new Error("Failed to fetch review item");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useReviewDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      reviewId: string;
      action: "approve" | "reject" | "edit";
      editedData?: Record<string, unknown>;
      notes?: string;
    }) => {
      const res = await fetch("/api/gatekeeper/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit decision");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gatekeeper-review"] });
      queryClient.invalidateQueries({ queryKey: ["gatekeeper-stats"] });
    },
  });
}

export function useGatekeeperStats() {
  return useQuery({
    queryKey: ["gatekeeper-stats"],
    queryFn: async () => {
      const res = await fetch("/api/gatekeeper/stats");
      if (!res.ok) throw new Error("Failed to fetch gatekeeper stats");
      return res.json();
    },
    refetchInterval: 30_000, // Refresh every 30 seconds
  });
}
