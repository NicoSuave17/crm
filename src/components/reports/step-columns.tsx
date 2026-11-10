"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { getReportType } from "@/lib/admin/report-type-registry";
import { FormulaEditor } from "./formula-editor";

interface StepColumnsProps {
  reportType: string;
  format: string;
  columns: string[];
  onColumnsChange: (cols: string[]) => void;
  groupByRows: string[];
  onGroupByRowsChange: (rows: string[]) => void;
  aggregations: { field: string; function: "count" | "count_distinct" | "sum" | "avg" | "min" | "max"; alias: string; condition?: { field: string; op: string; value: unknown } }[];
  onAggregationsChange: (aggs: { field: string; function: "count" | "count_distinct" | "sum" | "avg" | "min" | "max"; alias: string; condition?: { field: string; op: string; value: unknown } }[]) => void;
  calculatedFields: { name: string; formula: string; outputType: "number" | "currency" | "percent" | "text" }[];
  onCalculatedFieldsChange: (cfs: { name: string; formula: string; outputType: "number" | "currency" | "percent" | "text" }[]) => void;
}

export function StepColumns({
  reportType,
  format,
  columns,
  onColumnsChange,
  groupByRows,
  onGroupByRowsChange,
  aggregations,
  onAggregationsChange,
  calculatedFields,
  onCalculatedFieldsChange,
}: StepColumnsProps) {
  const rt = getReportType(reportType);
  const fields = rt?.availableFields ?? [];
  const [showFormulaEditor, setShowFormulaEditor] = useState(false);
  const [newFormula, setNewFormula] = useState<{ name: string; formula: string; outputType: "number" | "currency" | "percent" | "text" }>({ name: "", formula: "", outputType: "number" });

  function toggleColumn(key: string) {
    onColumnsChange(
      columns.includes(key)
        ? columns.filter((c) => c !== key)
        : [...columns, key]
    );
  }

  function toggleGroupBy(key: string) {
    onGroupByRowsChange(
      groupByRows.includes(key)
        ? groupByRows.filter((r) => r !== key)
        : [...groupByRows, key]
    );
  }

  function addAggregation() {
    const aggFields = fields.filter((f) => f.aggregatable);
    if (aggFields.length === 0) return;
    onAggregationsChange([
      ...aggregations,
      {
        field: aggFields[0].key,
        function: "count",
        alias: `count_${aggregations.length + 1}`,
      },
    ]);
  }

  function updateAggregation(index: number, updates: Partial<typeof aggregations[number]>) {
    const updated = [...aggregations];
    updated[index] = { ...updated[index], ...updates };
    onAggregationsChange(updated);
  }

  function removeAggregation(index: number) {
    onAggregationsChange(aggregations.filter((_, i) => i !== index));
  }

  function addCalculatedField() {
    if (!newFormula.name || !newFormula.formula) return;
    onCalculatedFieldsChange([...calculatedFields, { ...newFormula }]);
    setNewFormula({ name: "", formula: "", outputType: "number" });
    setShowFormulaEditor(false);
  }

  const isSummary = format === "summary" || format === "matrix";

  return (
    <div className="space-y-6">
      {/* Column selection */}
      {!isSummary && (
        <div>
          <Label className="mb-2 block">Select Columns</Label>
          <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto border rounded-md p-3">
            {fields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm py-0.5">
                <Checkbox
                  checked={columns.includes(field.key)}
                  onCheckedChange={() => toggleColumn(field.key)}
                />
                <span className="truncate">{field.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {columns.length} column{columns.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      {/* Group By (for summary/matrix) */}
      {isSummary && (
        <div>
          <Label className="mb-2 block">Group By</Label>
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-3">
            {fields
              .filter((f) => f.groupable)
              .map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm py-0.5">
                  <Checkbox
                    checked={groupByRows.includes(field.key)}
                    onCheckedChange={() => toggleGroupBy(field.key)}
                  />
                  <span className="truncate">{field.label}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      {/* Aggregations */}
      {isSummary && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Aggregations</Label>
            <Button variant="outline" size="sm" onClick={addAggregation}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {aggregations.map((agg, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={agg.function}
                  onValueChange={(v) => updateAggregation(i, { function: v as "count" | "count_distinct" | "sum" | "avg" | "min" | "max" })}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="count_distinct">Count Distinct</SelectItem>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Avg</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={agg.field}
                  onValueChange={(v) => updateAggregation(i, { field: v })}
                >
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields
                      .filter((f) => f.aggregatable)
                      .map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  value={agg.alias}
                  onChange={(e) => updateAggregation(i, { alias: e.target.value })}
                  placeholder="Alias"
                  className="w-32 h-8"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeAggregation(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculated Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Calculated Fields</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFormulaEditor(!showFormulaEditor)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Formula
          </Button>
        </div>

        {calculatedFields.length > 0 && (
          <div className="space-y-1 mb-3">
            {calculatedFields.map((cf, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{cf.name}</Badge>
                <code className="text-xs text-muted-foreground flex-1 truncate">
                  {cf.formula}
                </code>
                <Badge variant="secondary" className="text-[10px]">
                  {cf.outputType}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    onCalculatedFieldsChange(calculatedFields.filter((_, j) => j !== i))
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {showFormulaEditor && (
          <div className="border rounded-md p-3 space-y-3">
            <Input
              value={newFormula.name}
              onChange={(e) => setNewFormula({ ...newFormula, name: e.target.value })}
              placeholder="Field name (e.g., annualValue)"
              className="h-8"
            />
            <FormulaEditor
              formula={newFormula.formula}
              onChange={(f) => setNewFormula({ ...newFormula, formula: f })}
              outputType={newFormula.outputType}
              onOutputTypeChange={(t) => setNewFormula({ ...newFormula, outputType: t as "number" | "currency" | "percent" | "text" })}
              availableFields={fields.map((f) => f.key)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addCalculatedField} disabled={!newFormula.name || !newFormula.formula}>
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowFormulaEditor(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
