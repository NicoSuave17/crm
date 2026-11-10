"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { getReportType } from "@/lib/admin/report-type-registry";
import type { FilterGroup, FilterCondition } from "@/lib/validators/report";

const OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater or equal" },
  { value: "<=", label: "less or equal" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "is_null", label: "is empty" },
  { value: "is_not_null", label: "is not empty" },
  { value: "in", label: "in" },
];

interface StepFiltersProps {
  reportType: string;
  filters: FilterGroup;
  onFiltersChange: (filters: FilterGroup) => void;
  dateBucket?: "day" | "week" | "month" | "quarter" | "year";
  onDateBucketChange: (bucket: "day" | "week" | "month" | "quarter" | "year" | undefined) => void;
  sortBy: { field: string; direction: "asc" | "desc" }[];
  onSortByChange: (sort: { field: string; direction: "asc" | "desc" }[]) => void;
}

export function StepFilters({
  reportType,
  filters,
  onFiltersChange,
  dateBucket,
  onDateBucketChange,
  sortBy,
  onSortByChange,
}: StepFiltersProps) {
  const rt = getReportType(reportType);
  const fields = rt?.availableFields ?? [];

  function addCondition() {
    const filterableFields = fields.filter((f) => f.filterable);
    if (filterableFields.length === 0) return;

    onFiltersChange({
      ...filters,
      conditions: [
        ...filters.conditions,
        {
          field: filterableFields[0].key,
          op: "=",
          value: "",
        } as FilterCondition,
      ],
    });
  }

  function updateCondition(index: number, updates: Partial<FilterCondition>) {
    const newConditions = [...filters.conditions];
    newConditions[index] = { ...newConditions[index], ...updates } as FilterCondition;
    onFiltersChange({ ...filters, conditions: newConditions });
  }

  function removeCondition(index: number) {
    onFiltersChange({
      ...filters,
      conditions: filters.conditions.filter((_, i) => i !== index),
    });
  }

  function addSort() {
    const sortableFields = fields.filter((f) => f.key);
    if (sortableFields.length === 0) return;
    onSortByChange([
      ...sortBy,
      { field: sortableFields[0].key, direction: "asc" },
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Filter conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Filters</Label>
          <div className="flex items-center gap-2">
            <Select
              value={filters.operator}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, operator: v as "AND" | "OR" })
              }
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="mr-1 h-3 w-3" />
              Add Filter
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {filters.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              No filters — all records will be included.
            </p>
          )}
          {filters.conditions.map((cond, i) => {
            if ("operator" in cond) return null; // Nested groups not rendered here
            const fc = cond as FilterCondition;
            const fieldDef = fields.find((f) => f.key === fc.field);
            const isNullOp = fc.op === "is_null" || fc.op === "is_not_null";

            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-xs text-muted-foreground w-10 text-center">
                    {filters.operator}
                  </span>
                )}
                <Select
                  value={fc.field}
                  onValueChange={(v) => updateCondition(i, { field: v })}
                >
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields
                      .filter((f) => f.filterable)
                      .map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={fc.op}
                  onValueChange={(v) => updateCondition(i, { op: v })}
                >
                  <SelectTrigger className="w-36 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!isNullOp && (
                  <>
                    {fieldDef?.enumValues ? (
                      <Select
                        value={String(fc.value)}
                        onValueChange={(v) => updateCondition(i, { value: v })}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldDef.enumValues.map((ev) => (
                            <SelectItem key={ev} value={ev}>
                              {ev.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(fc.value ?? "")}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                        placeholder="Value"
                        className="flex-1 h-8"
                      />
                    )}
                  </>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeCondition(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date bucketing */}
      <div>
        <Label className="mb-2 block">Date Bucketing (for grouped date fields)</Label>
        <Select
          value={dateBucket ?? "none"}
          onValueChange={(v) => onDateBucketChange(v === "none" ? undefined : v as "day" | "week" | "month" | "quarter" | "year")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sorting */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Sort By</Label>
          <Button variant="outline" size="sm" onClick={addSort}>
            <Plus className="mr-1 h-3 w-3" />
            Add Sort
          </Button>
        </div>
        <div className="space-y-2">
          {sortBy.map((sort, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={sort.field}
                onValueChange={(v) => {
                  const newSort = [...sortBy];
                  newSort[i] = { ...sort, field: v };
                  onSortByChange(newSort);
                }}
              >
                <SelectTrigger className="flex-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sort.direction}
                onValueChange={(v) => {
                  const newSort = [...sortBy];
                  newSort[i] = { ...sort, direction: v as "asc" | "desc" };
                  onSortByChange(newSort);
                }}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Asc</SelectItem>
                  <SelectItem value="desc">Desc</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onSortByChange(sortBy.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
