"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePipelines() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline");
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      return res.json();
    },
  });
}

export function usePipelineWithDeals(pipelineId: string) {
  return useQuery({
    queryKey: ["pipeline", pipelineId],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline/${pipelineId}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    },
    enabled: !!pipelineId,
  });
}

export function useMoveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
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
        throw new Error((body?.error as string) || "Failed to move deal");
      }
      return res.json();
    },
    onMutate: async ({ dealId, stageId }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      await queryClient.cancelQueries({ queryKey: ["deals"] });

      // Snapshot the previous pipeline data for all cached pipelines
      const previousData = queryClient.getQueriesData({ queryKey: ["pipeline"] });

      // Optimistically update the deal's stageId in every matching pipeline cache entry
      queryClient.setQueriesData(
        { queryKey: ["pipeline"] },
        (old: Record<string, unknown> | undefined) => {
          if (!old || !Array.isArray((old as { deals?: unknown[] }).deals)) return old;
          const typedOld = old as { deals: Array<{ id: string; stageId: string }> };
          return {
            ...typedOld,
            deals: typedOld.deals.map((d) =>
              d.id === dealId ? { ...d, stageId } : d
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the previous state on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

// ─── Pipeline Mutations ─────────────────────────────────────────

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; type: string }) => {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

// ─── Stage Mutations ────────────────────────────────────────────

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, data }: { pipelineId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageId, data }: { pipelineId: string; stageId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageId }: { pipelineId: string; stageId: string }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/${stageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageIds }: { pipelineId: string; stageIds: string[] }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reorder stages");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
