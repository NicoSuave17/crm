"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartTypePicker } from "./chart-type-picker";
import { ChartRenderer } from "./chart-renderer";
import { ReportTable } from "./report-table";
import { usePreviewReport } from "@/lib/hooks/use-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import type { ReportConfigType, ChartConfigType } from "@/lib/validators/report";
import { getReportType } from "@/lib/admin/report-type-registry";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "ae", label: "AE" },
  { value: "enterprise_sales", label: "Enterprise Sales" },
];

interface StepVisualizationProps {
  config: ReportConfigType;
  chart: ChartConfigType | null;
  onChartChange: (chart: ChartConfigType | null) => void;
  roles: string[];
  onRolesChange: (roles: string[]) => void;
}

export function StepVisualization({
  config,
  chart,
  onChartChange,
  roles,
  onRolesChange,
}: StepVisualizationProps) {
  const preview = usePreviewReport();
  const rt = getReportType(config.reportType);
  const fields = rt?.availableFields ?? [];

  function handlePreview() {
    preview.mutate(config);
  }

  function toggleRole(role: string) {
    onRolesChange(
      roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
    );
  }

  function updateChart(updates: Partial<ChartConfigType>) {
    if (!chart) return;
    onChartChange({ ...chart, ...updates });
  }

  return (
    <div className="space-y-6">
      {/* Chart type selection */}
      <div>
        <Label className="mb-3 block">Chart Type (optional)</Label>
        <ChartTypePicker
          value={chart?.type ?? null}
          onChange={(type) => {
            if (!type) {
              onChartChange(null);
            } else {
              onChartChange({
                type: type as ChartConfigType["type"],
                xAxis: chart?.xAxis ?? config.columns[0],
                yAxis: chart?.yAxis ?? (config.columns.length > 1 ? [config.columns[1]] : []),
                showLegend: true,
                showLabels: true,
              });
            }
          }}
        />
      </div>

      {/* Chart axis configuration */}
      {chart && (
        <div className="grid grid-cols-2 gap-4 border rounded-md p-4">
          <div>
            <Label>X-Axis (Dimension)</Label>
            <Select
              value={chart.xAxis ?? ""}
              onValueChange={(v) => updateChart({ xAxis: v })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Y-Axis (Measure)</Label>
            <Select
              value={chart.yAxis?.[0] ?? ""}
              onValueChange={(v) => updateChart({ yAxis: [v] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter((f) => f.aggregatable || f.type === "number" || f.type === "currency")
                  .map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chart.showLegend ?? true}
                onCheckedChange={(c) => updateChart({ showLegend: !!c })}
              />
              Show Legend
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chart.showLabels ?? true}
                onCheckedChange={(c) => updateChart({ showLabels: !!c })}
              />
              Show Labels
            </label>
          </div>
        </div>
      )}

      {/* Role access */}
      <div>
        <Label className="mb-2 block">Share with Roles</Label>
        <div className="flex flex-wrap gap-3">
          {ALL_ROLES.map((role) => (
            <label key={role.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={roles.includes(role.value)}
                onCheckedChange={() => toggleRole(role.value)}
              />
              {role.label}
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Preview</Label>
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={preview.isPending}>
            <Eye className="mr-1 h-3 w-3" />
            {preview.isPending ? "Loading..." : "Run Preview"}
          </Button>
        </div>

        {preview.isPending && (
          <Skeleton className="h-64 w-full" />
        )}

        {preview.isError && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4 text-sm text-destructive">
            {preview.error.message}
          </div>
        )}

        {preview.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{preview.data.metadata.rowCount} rows</Badge>
              <Badge variant="secondary">{preview.data.metadata.executionMs}ms</Badge>
              {preview.data.metadata.truncated && (
                <Badge variant="destructive">Truncated</Badge>
              )}
            </div>

            {chart && preview.data.rows.length > 0 && (
              <ChartRenderer
                config={chart}
                data={preview.data.rows}
                height={300}
              />
            )}

            <ReportTable
              columns={preview.data.columns}
              rows={preview.data.rows.slice(0, 20)}
              aggregates={preview.data.aggregates}
              groupedData={preview.data.groupedData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
