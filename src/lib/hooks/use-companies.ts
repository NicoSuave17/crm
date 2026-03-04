"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchCompanies() {
  const res = await fetch("/api/companies?limit=100");
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}
