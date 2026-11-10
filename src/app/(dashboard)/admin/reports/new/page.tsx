"use client";

import { useRouter } from "next/navigation";
import { useCreateReport } from "@/lib/hooks/use-reports";
import { ReportBuilderWizard } from "@/components/reports/report-builder-wizard";
import { toast } from "sonner";

export default function NewReportPage() {
  const router = useRouter();
  const createReport = useCreateReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Report</h1>
        <p className="text-sm text-muted-foreground">
          Build a new report using the wizard below.
        </p>
      </div>

      <ReportBuilderWizard
        onSave={(data) => {
          createReport.mutate(
            {
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
                toast.success("Report created");
                router.push("/admin/reports");
              },
              onError: () => toast.error("Failed to create report"),
            }
          );
        }}
        isPending={createReport.isPending}
      />
    </div>
  );
}
