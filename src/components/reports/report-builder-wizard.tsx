"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepReportType } from "./step-report-type";
import { StepColumns } from "./step-columns";
import { StepFilters } from "./step-filters";
import { StepVisualization } from "./step-visualization";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import type { ReportConfigType, ChartConfigType } from "@/lib/validators/report";
import type { FilterGroup } from "@/lib/validators/report";

type AggFunction = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
type StepColumnsAggs = { field: string; function: AggFunction; alias: string; condition?: { field: string; op: string; value: unknown } }[];
type StepColumnsCFs = { name: string; formula: string; outputType: "number" | "currency" | "percent" | "text" }[];

const STEPS = [
  { id: 1, label: "Report Type" },
  { id: 2, label: "Columns" },
  { id: 3, label: "Filters" },
  { id: 4, label: "Visualization" },
];

interface ReportBuilderWizardProps {
  initialConfig?: Partial<ReportConfigType>;
  initialName?: string;
  initialFormat?: string;
  onSave: (data: {
    name: string;
    description: string;
    reportType: string;
    format: string;
    config: ReportConfigType;
    roles: string[];
  }) => void;
  isPending?: boolean;
}

export function ReportBuilderWizard({
  initialConfig,
  initialName,
  initialFormat,
  onSave,
  isPending,
}: ReportBuilderWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState("");
  const [reportType, setReportType] = useState(initialConfig?.reportType ?? "");
  const [format, setFormat] = useState(initialFormat ?? "tabular");
  const [columns, setColumns] = useState<string[]>(initialConfig?.columns ?? []);
  const [groupByRows, setGroupByRows] = useState<string[]>(
    initialConfig?.groupBy?.rows ?? []
  );
  const [aggregations, setAggregations] = useState(
    initialConfig?.aggregations ?? []
  );
  const [calculatedFields, setCalculatedFields] = useState(
    initialConfig?.calculatedFields ?? []
  );
  const [filters, setFilters] = useState<FilterGroup>(
    initialConfig?.filters ?? { operator: "AND", conditions: [] }
  );
  const [dateBucket, setDateBucket] = useState(initialConfig?.dateBucket);
  const [sortBy, setSortBy] = useState(initialConfig?.sortBy ?? []);
  const [chart, setChart] = useState<ChartConfigType | null>(
    (initialConfig?.chart as ChartConfigType) ?? null
  );
  const [roles, setRoles] = useState<string[]>([
    "admin",
    "manager",
    "account_manager",
    "ae",
    "enterprise_sales",
  ]);

  function buildConfig(): ReportConfigType {
    return {
      reportType,
      columns,
      filters: filters.conditions.length > 0 ? filters : undefined,
      groupBy:
        groupByRows.length > 0 ? { rows: groupByRows } : undefined,
      aggregations,
      calculatedFields:
        calculatedFields.length > 0 ? calculatedFields : undefined,
      sortBy: sortBy.length > 0 ? sortBy : undefined,
      dateBucket,
      chart,
      limit: 5000,
    };
  }

  function handleSave() {
    onSave({
      name,
      description,
      reportType,
      format,
      config: buildConfig(),
      roles,
    });
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                step === s.id
                  ? "bg-primary text-primary-foreground"
                  : step > s.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="font-bold">{s.id}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-muted mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepReportType
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          reportType={reportType}
          onReportTypeChange={(rt) => {
            setReportType(rt);
            setColumns([]);
            setGroupByRows([]);
            setAggregations([]);
          }}
          format={format}
          onFormatChange={setFormat}
        />
      )}

      {step === 2 && (
        <StepColumns
          reportType={reportType}
          format={format}
          columns={columns}
          onColumnsChange={setColumns}
          groupByRows={groupByRows}
          onGroupByRowsChange={setGroupByRows}
          aggregations={aggregations as StepColumnsAggs}
          onAggregationsChange={setAggregations as (aggs: StepColumnsAggs) => void}
          calculatedFields={calculatedFields as StepColumnsCFs}
          onCalculatedFieldsChange={setCalculatedFields as (cfs: StepColumnsCFs) => void}
        />
      )}

      {step === 3 && (
        <StepFilters
          reportType={reportType}
          filters={filters}
          onFiltersChange={setFilters}
          dateBucket={dateBucket}
          onDateBucketChange={setDateBucket}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />
      )}

      {step === 4 && (
        <StepVisualization
          config={buildConfig()}
          chart={chart}
          onChartChange={setChart}
          roles={roles}
          onRolesChange={setRoles}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex gap-2">
          {step < 4 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!reportType || !name)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={handleSave} disabled={isPending || !name || !reportType}>
              <Save className="mr-1 h-4 w-4" />
              {isPending ? "Saving..." : "Save Report"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
