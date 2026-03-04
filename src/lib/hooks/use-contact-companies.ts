"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface LinkedCompany {
  companyId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  role: string | null;
  isPrimary: boolean | null;
}

interface LinkedContact {
  contactId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  type: string;
  role: string | null;
  isPrimary: boolean | null;
}

export function useContactCompanies(contactId: string) {
  return useQuery<LinkedCompany[]>({
    queryKey: ["contact-companies", contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/companies`);
      if (!res.ok) throw new Error("Failed to fetch contact companies");
      return res.json();
    },
    enabled: !!contactId,
  });
}

export function useLinkCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      companyId,
      role,
    }: {
      contactId: string;
      companyId: string;
      role?: string;
    }) => {
      const res = await fetch(`/api/contacts/${contactId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to link company");
      }
      return res.json();
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ["contact-companies", contactId] });
      queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
    },
  });
}

export function useUnlinkCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      companyId,
    }: {
      contactId: string;
      companyId: string;
    }) => {
      const res = await fetch(
        `/api/contacts/${contactId}/companies/${companyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to unlink company");
      return res.json();
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ["contact-companies", contactId] });
      queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
    },
  });
}

export function useCompanyContacts(companyId: string) {
  return useQuery<LinkedContact[]>({
    queryKey: ["company-contacts", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/contacts`);
      if (!res.ok) throw new Error("Failed to fetch company contacts");
      return res.json();
    },
    enabled: !!companyId,
  });
}
