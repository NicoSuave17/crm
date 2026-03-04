"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function bulkPatch(body: Record<string, unknown>) {
  const res = await fetch("/api/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bulk operation failed" }));
    throw new Error(err.error || "Bulk operation failed");
  }
  return res.json();
}

// ─── Contacts ──────────────────────────────────────────────────

export function useBulkReassignContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[]; newOwnerId: string }) =>
      bulkPatch({ action: "reassign_contacts", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useBulkStatusContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[]; status: string }) =>
      bulkPatch({ action: "change_status_contacts", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useBulkTagContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[]; tagId: string }) =>
      bulkPatch({ action: "add_tag_contacts", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[] }) =>
      bulkPatch({ action: "delete_contacts", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

// ─── Deals ─────────────────────────────────────────────────────

export function useBulkStageDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealIds: string[]; stageId: string }) =>
      bulkPatch({ action: "bulk_stage_change", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useBulkTagDeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealIds: string[]; tagId: string }) =>
      bulkPatch({ action: "add_tag_deals", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useBulkDeleteDeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealIds: string[] }) =>
      bulkPatch({ action: "delete_deals", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
