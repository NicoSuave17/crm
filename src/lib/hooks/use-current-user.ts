"use client";

import { useQuery } from "@tanstack/react-query";

interface CrmUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
}

export function useCurrentUser() {
  const { data: user, isLoading } = useQuery<CrmUser>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error("Failed to fetch current user");
      return res.json();
    },
    staleTime: Infinity,
  });

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return { user, isLoading, isAdminOrManager };
}
