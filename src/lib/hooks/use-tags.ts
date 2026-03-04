"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create tag");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tag");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useAddTagToContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactId: string; tagId: string }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useRemoveTagFromContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactId: string; tagId: string }) => {
      const res = await fetch(`/api/tags/contact`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to remove tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useAddTagToDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; tagId: string }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useRemoveTagFromDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; tagId: string }) => {
      const res = await fetch("/api/tags/deal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to remove tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}
