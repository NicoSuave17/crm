"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useFieldDefinitions(entityType?: string) {
  return useQuery({
    queryKey: ["custom-fields", "definitions", entityType],
    queryFn: async () => {
      const params = entityType ? `?entityType=${entityType}` : "";
      const res = await fetch(`/api/custom-fields${params}`);
      if (!res.ok) throw new Error("Failed to fetch field definitions");
      return res.json();
    },
  });
}

export function useFieldValues(entityId: string | undefined) {
  return useQuery({
    queryKey: ["custom-fields", "values", entityId],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityId=${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch field values");
      return res.json();
    },
    enabled: !!entityId,
  });
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      entityType: string;
      name: string;
      label: string;
      fieldType: string;
      options?: { value: string; label: string; color?: string }[];
      isRequired?: boolean;
      isVisibleInList?: boolean;
    }) => {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create field");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["custom-fields", "definitions"] }),
  });
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        label: string;
        options: { value: string; label: string; color?: string }[];
        isRequired: boolean;
        isVisibleInList: boolean;
      }>;
    }) => {
      const res = await fetch(`/api/custom-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update field");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["custom-fields", "definitions"],
      }),
  });
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete field");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["custom-fields", "definitions"] }),
  });
}

export function useSetFieldValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      fieldDefinitionId: string;
      entityId: string;
      textValue?: string;
      numberValue?: string;
      dateValue?: string;
      booleanValue?: boolean;
    }) => {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to set field value");
      return res.json();
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["custom-fields", "values", variables.entityId],
      }),
  });
}
