"use client";

import { useQuery } from "@tanstack/react-query";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  section: "main" | "bottom";
  position: number;
  parentId: string | null;
  savedViewId: string | null;
  entityType: string | null;
  isSystem: boolean;
  children?: NavItem[];
}

async function fetchNavItems(): Promise<NavItem[]> {
  const res = await fetch("/api/admin/nav");
  if (!res.ok) throw new Error("Failed to fetch navigation");
  return res.json();
}

export function useNavItems() {
  return useQuery({
    queryKey: ["admin", "nav"],
    queryFn: fetchNavItems,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
