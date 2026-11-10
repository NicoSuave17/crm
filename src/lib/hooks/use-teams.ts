"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  managerId: string | null;
  managerFirstName: string | null;
  managerLastName: string | null;
  members: TeamMember[];
  createdAt: string;
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      managerId?: string;
      memberIds?: string[];
    }) => {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create team");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      managerId?: string | null;
      memberIds?: string[];
    }) => {
      const res = await fetch(`/api/admin/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update team");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}
