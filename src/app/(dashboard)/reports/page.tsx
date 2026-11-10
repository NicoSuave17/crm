"use client";

import Link from "next/link";
import { useReports } from "@/lib/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const { data: reports = [], isLoading } = useReports();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          View and interact with shared reports.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No reports available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Reports will appear here once an admin creates them.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.id} href={`/reports/${report.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{report.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {report.format}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {report.description && (
                  <p className="text-sm text-muted-foreground">
                    {report.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Type: {report.reportType.replace(/_/g, " ")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
