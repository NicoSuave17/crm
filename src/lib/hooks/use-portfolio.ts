"use client";

import { useQuery } from "@tanstack/react-query";

interface PortfolioParams {
  ownerId?: string;
  sortBy?: string;
  sortDir?: string;
  churnRisk?: string;
  vertical?: string;
}

export function usePortfolio(params: PortfolioParams = {}) {
  return useQuery({
    queryKey: ["portfolio", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.ownerId) searchParams.set("ownerId", params.ownerId);
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.sortDir) searchParams.set("sortDir", params.sortDir);
      if (params.churnRisk) searchParams.set("churnRisk", params.churnRisk);
      if (params.vertical) searchParams.set("vertical", params.vertical);

      const qs = searchParams.toString();
      const res = await fetch(`/api/portfolio${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
  });
}
