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

export function useBulkLinkCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[]; companyId: string }) =>
      bulkPatch({ action: "link_contacts_company", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

// ─── Companies ────────────────────────────────────────────────

export function useBulkReassignCompanies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { companyIds: string[]; newOwnerId: string }) =>
      bulkPatch({ action: "reassign_companies", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useBulkDeleteCompanies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { companyIds: string[] }) =>
      bulkPatch({ action: "delete_companies", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
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

export function useBulkReassignDeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealIds: string[]; newOwnerId: string }) =>
      bulkPatch({ action: "reassign_deals", ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

// ─── Round Robin ──────────────────────────────────────────────

export function useBulkRoundRobin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      entityIds: string[];
      entityType: "contact" | "deal" | "company";
      userIds: string[];
    }) => bulkPatch({ action: "round_robin", ...data }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.entityType === "contact" ? "contacts" : variables.entityType === "deal" ? "deals" : "companies"] });
      if (variables.entityType === "deal") {
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      }
    },
  });
}
