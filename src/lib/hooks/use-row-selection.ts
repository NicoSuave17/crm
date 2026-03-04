"use client";

import { useState, useCallback, useMemo } from "react";

export interface UseRowSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: (allIds: string[]) => void;
  clear: () => void;
  count: number;
  isAllSelected: (allIds: string[]) => boolean;
  isSomeSelected: (allIds: string[]) => boolean;
}

export function useRowSelection(): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected =
        allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        // Deselect all from current page
        const next = new Set(prev);
        for (const id of allIds) {
          next.delete(id);
        }
        return next;
      }
      // Select all from current page
      const next = new Set(prev);
      for (const id of allIds) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const isAllSelected = useCallback(
    (allIds: string[]) =>
      allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const isSomeSelected = useCallback(
    (allIds: string[]) => {
      const some = allIds.some((id) => selectedIds.has(id));
      const all = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
      return some && !all;
    },
    [selectedIds]
  );

  const count = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    clear,
    count,
    isAllSelected,
    isSomeSelected,
  };
}
