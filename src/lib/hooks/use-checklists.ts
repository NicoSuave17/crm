import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Stage Checklist Definitions (Settings) ────────────────────

export interface StageChecklistItem {
  id: string;
  stageId: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  position: number;
  createdAt: string;
}

export function useStageChecklists(stageId: string | null) {
  return useQuery<StageChecklistItem[]>({
    queryKey: ["stage-checklists", stageId],
    queryFn: async () => {
      // We need the pipelineId for the URL, but since we may not have it,
      // we use a placeholder — the API only uses stageId from params anyway
      const res = await fetch(
        `/api/pipeline/_/stages/${stageId}/checklists`
      );
      if (!res.ok) throw new Error("Failed to load checklists");
      return res.json();
    },
    enabled: !!stageId,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      stageId: string;
      title: string;
      description?: string;
      isRequired?: boolean;
    }) => {
      const res = await fetch(
        `/api/pipeline/_/stages/${data.stageId}/checklists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create checklist item");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["stage-checklists", vars.stageId] });
    },
  });
}

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      stageId: string;
      checklistId: string;
      title?: string;
      description?: string | null;
      position?: number;
    }) => {
      const res = await fetch(
        `/api/pipeline/_/stages/${data.stageId}/checklists`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update checklist item");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["stage-checklists", vars.stageId] });
    },
  });
}

export function useDeleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { stageId: string; checklistId: string }) => {
      const res = await fetch(
        `/api/pipeline/_/stages/${data.stageId}/checklists?checklistId=${data.checklistId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete checklist item");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["stage-checklists", vars.stageId] });
    },
  });
}

// ─── Deal Checklist Status ─────────────────────────────────────

export interface DealChecklistItem {
  checklistId: string;
  title: string;
  description: string | null;
  position: number;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}

export function useDealChecklist(dealId: string | null) {
  return useQuery<DealChecklistItem[]>({
    queryKey: ["deal-checklist", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/checklist`);
      if (!res.ok) throw new Error("Failed to load deal checklist");
      return res.json();
    },
    enabled: !!dealId,
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      dealId: string;
      checklistId: string;
      completed: boolean;
    }) => {
      const res = await fetch(`/api/deals/${data.dealId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistId: data.checklistId,
          completed: data.completed,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to toggle checklist item");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["deal-checklist", vars.dealId] });
    },
  });
}
