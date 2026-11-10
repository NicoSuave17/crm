"use client";

import { use, useState } from "react";
import { useReport, useExecuteReport } from "@/lib/hooks/use-reports";
import { ChartRenderer } from "@/components/reports/chart-renderer";
import { ReportTable } from "@/components/reports/report-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Download, Maximize2, Minimize2 } from "lucide-react";
import type { ChartConfigType } from "@/lib/validators/report";

export default function ReportViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: report, isLoading: loadingReport } = useReport(id);
  const { data: result, isLoading: loadingResult, refetch } = useExecuteReport(id);
  const [fullscreen, setFullscreen] = useState(false);

  if (loadingReport) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!report) {
    return <p className="text-muted-foreground">Report not found.</p>;
  }

  const chartConfig = (report.config as Record<string, unknown>)?.chart as ChartConfigType | null;

  function handleExportCsv() {
    if (!result) return;
    const headers = result.columns.map((c) => c.label).join(",");
    const rows = result.rows.map((row) =>
      result.columns.map((c) => {
        const val = row[c.key];
        return val == null ? "" : `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(report?.name ?? "report").replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : "space-y-6"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{report.name}</h1>
          {report.description && (
            <p className="text-sm text-muted-foreground">{report.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <Badge variant="secondary" className="text-xs">
                {result.metadata.rowCount} rows
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {result.metadata.executionMs}ms
              </Badge>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!result}>
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {loadingResult && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {result && (
        <div className="space-y-6 mt-6">
          {chartConfig && result.rows.length > 0 && (
            <ChartRenderer
              config={chartConfig}
              data={result.rows}
              height={fullscreen ? 400 : 300}
            />
          )}

          <ReportTable
            columns={result.columns}
            rows={result.rows}
            aggregates={result.aggregates}
            groupedData={result.groupedData}
          />
        </div>
      )}
    </div>
  );
}
