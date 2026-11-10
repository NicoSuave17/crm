"use client";

import { useQuery } from "@tanstack/react-query";

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  isVisibleInList: boolean | null;
}

export function useVisibleCustomFields(entityType: string) {
  return useQuery<FieldDefinition[]>({
    queryKey: ["custom-field-definitions", entityType, "visible"],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityType=${entityType}`);
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      const all: FieldDefinition[] = await res.json();
      return all.filter((f) => f.isVisibleInList);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomFieldValues(
  entityType: string,
  entityIds: string[]
) {
  const idsKey = entityIds.sort().join(",");

  return useQuery<Record<string, Record<string, string>>>({
    queryKey: ["custom-field-values-batch", entityType, idsKey],
    queryFn: async () => {
      if (entityIds.length === 0) return {};
      const res = await fetch(
        `/api/custom-fields/batch?entityType=${entityType}&entityIds=${entityIds.join(",")}`
      );
      if (!res.ok) throw new Error("Failed to fetch custom field values");
      return res.json();
    },
    enabled: entityIds.length > 0,
    staleTime: 30 * 1000,
  });
}
