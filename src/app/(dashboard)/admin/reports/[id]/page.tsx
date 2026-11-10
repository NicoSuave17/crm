"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useReport, useUpdateReport } from "@/lib/hooks/use-reports";
import { ReportBuilderWizard } from "@/components/reports/report-builder-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { ReportConfigType } from "@/lib/validators/report";

export default function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: report, isLoading } = useReport(id);
  const updateReport = useUpdateReport();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!report) {
    return <p className="text-muted-foreground">Report not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Report</h1>
        <p className="text-sm text-muted-foreground">{report.name}</p>
      </div>

      <ReportBuilderWizard
        initialConfig={report.config as unknown as Partial<ReportConfigType>}
        initialName={report.name}
        initialFormat={report.format}
        onSave={(data) => {
          updateReport.mutate(
            {
              id,
              name: data.name,
              description: data.description,
              reportType: data.reportType,
              format: data.format as "tabular" | "summary" | "matrix",
              config: data.config,
              isShared: true,
              roles: data.roles,
            },
            {
              onSuccess: () => {
                toast.success("Report updated");
                router.push("/admin/reports");
              },
              onError: () => toast.error("Failed to update report"),
            }
          );
        }}
        isPending={updateReport.isPending}
      />
    </div>
  );
}
