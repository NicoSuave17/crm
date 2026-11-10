"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateReportType, ReportConfigType } from "@/lib/validators/report";

interface Report {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  format: string;
  config: Record<string, unknown>;
  createdBy: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReportResult {
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  aggregates?: Record<string, unknown>;
  groupedData?: {
    groupKey: Record<string, unknown>;
    rows: Record<string, unknown>[];
    aggregates: Record<string, unknown>;
  }[];
  metadata: { rowCount: number; executionMs: number; truncated: boolean };
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports");
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });
}

export function useReport(id: string) {
  return useQuery<Report>({
    queryKey: ["reports", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports?id=${id}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const reports = await res.json();
      return Array.isArray(reports) ? reports.find((r: Report) => r.id === id) : reports;
    },
    enabled: !!id,
  });
}

export function useExecuteReport(id: string, overrides?: Record<string, unknown>) {
  return useQuery<ReportResult>({
    queryKey: ["reports", id, "execute", overrides],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides ?? {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to execute report");
      }
      return res.json();
    },
    enabled: !!id,
  });
}

export function usePreviewReport() {
  return useMutation<ReportResult, Error, ReportConfigType>({
    mutationFn: async (config) => {
      const res = await fetch("/api/admin/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to preview report");
      }
      return res.json();
    },
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateReportType) => {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string } & Partial<CreateReportType>) => {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update report");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports", id] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/reports?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete report");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
