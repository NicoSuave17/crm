"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateContactInput, UpdateContactInput } from "@/lib/validators/contact";

interface ContactListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  vertical?: string;
  ownerId?: string;
  companyId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

async function fetchContacts(params: ContactListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  const res = await fetch(`/api/contacts?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}

async function fetchContact(id: string) {
  const res = await fetch(`/api/contacts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch contact");
  return res.json();
}

export function useContacts(params: ContactListParams = {}) {
  return useQuery({
    queryKey: ["contacts", params],
    queryFn: () => fetchContacts(params),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ["contacts", id],
    queryFn: () => fetchContact(id),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateContactInput) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.status === 202) {
        // Submitted for review — not an error
        return { ...json, _pendingReview: true };
      }
      if (!res.ok) {
        throw new Error(json.error || "Failed to create contact");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateContactInput;
    }) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.status === 202) {
        return { ...json, _pendingReview: true };
      }
      if (!res.ok) {
        throw new Error(json.error || "Failed to update contact");
      }
      return json;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
