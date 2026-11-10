"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/lib/validators/company";

interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  size?: string;
  vertical?: string;
  ownerId?: string;
  tagId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

async function fetchCompanies(params: CompanyListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  const res = await fetch(`/api/companies?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

async function fetchCompany(id: string) {
  const res = await fetch(`/api/companies/${id}`);
  if (!res.ok) throw new Error("Failed to fetch company");
  return res.json();
}

export function useCompanies(params: CompanyListParams = {}) {
  return useQuery({
    queryKey: ["companies", params],
    queryFn: () => fetchCompanies(params),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["companies", id],
    queryFn: () => fetchCompany(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCompanyInput) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.status === 202) return { ...json, _pendingReview: true };
      if (!res.ok) throw new Error(json.error || "Failed to create company");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCompanyInput;
    }) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.status === 202) return { ...json, _pendingReview: true };
      if (!res.ok) throw new Error(json.error || "Failed to update company");
      return json;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete company");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
