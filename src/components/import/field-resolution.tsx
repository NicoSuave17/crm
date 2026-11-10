"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldDef {
  key: string;
  label: string;
}

export interface DuplicateRecord {
  csvRow: Record<string, string>;
  crmRecord: Record<string, unknown>;
  crmId: string;
  crmName: string;
}

export type DuplicateAction = "skip" | "overwrite" | "create";

export interface DuplicateResolution {
  action: DuplicateAction;
  /** For overwrite: which fields to take from CSV vs CRM */
  fieldChoices: Record<string, "crm" | "csv">;
}

interface FieldResolutionProps {
  duplicates: DuplicateRecord[];
  fields: FieldDef[];
  resolutions: Map<string, DuplicateResolution>;
  onResolutionsChange: (resolutions: Map<string, DuplicateResolution>) => void;
}

/** How many individual rows to render (rest are handled by bulk actions) */
const PAGE_SIZE = 25;

function getDefaultFieldChoices(
  crmRecord: Record<string, unknown>,
  csvRow: Record<string, string>,
  fields: FieldDef[]
): Record<string, "crm" | "csv"> {
  const choices: Record<string, "crm" | "csv"> = {};
  for (const field of fields) {
    const crmVal = crmRecord[field.key];
    const csvVal = csvRow[field.key];
    const crmEmpty = crmVal === null || crmVal === undefined || crmVal === "";
    const csvEmpty = !csvVal || csvVal === "";

    if (csvEmpty && !crmEmpty) {
      choices[field.key] = "crm"; // Don't blank out existing data
    } else if (!csvEmpty && crmEmpty) {
      choices[field.key] = "csv"; // Fill gaps
    } else if (!csvEmpty && !crmEmpty) {
      choices[field.key] = "csv"; // Prefer CSV (newer data)
    } else {
      choices[field.key] = "crm"; // Both empty
    }
  }
  return choices;
}

type BulkMode = "prefer_csv" | "keep_crm" | "skip" | null;

export function FieldResolution({
  duplicates,
  fields,
  resolutions,
  onResolutionsChange,
}: FieldResolutionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  // Initialize resolutions for any new duplicates
  useEffect(() => {
    const updated = new Map(resolutions);
    let changed = false;
    for (const dup of duplicates) {
      if (!updated.has(dup.crmId)) {
        updated.set(dup.crmId, {
          action: "overwrite",
          fieldChoices: getDefaultFieldChoices(dup.crmRecord, dup.csvRow, fields),
        });
        changed = true;
      }
    }
    if (changed) onResolutionsChange(updated);
  }, [duplicates]);

  function setAction(crmId: string, action: DuplicateAction) {
    const updated = new Map(resolutions);
    const existing = updated.get(crmId);
    updated.set(crmId, {
      action,
      fieldChoices: existing?.fieldChoices ?? {},
    });
    setBulkMode(null); // User is overriding per-row, clear bulk indicator
    onResolutionsChange(updated);
  }

  function setFieldChoice(crmId: string, fieldKey: string, choice: "crm" | "csv") {
    const updated = new Map(resolutions);
    const existing = updated.get(crmId) ?? { action: "overwrite" as DuplicateAction, fieldChoices: {} };
    updated.set(crmId, {
      ...existing,
      fieldChoices: { ...existing.fieldChoices, [fieldKey]: choice },
    });
    onResolutionsChange(updated);
  }

  function applyBulkDefault(mode: BulkMode) {
    if (!mode) return;
    setBulkMode(mode);

    startTransition(() => {
      const updated = new Map<string, DuplicateResolution>();
      for (const dup of duplicates) {
        if (mode === "skip") {
          updated.set(dup.crmId, { action: "skip", fieldChoices: {} });
        } else {
          const choices: Record<string, "crm" | "csv"> = {};
          if (mode === "prefer_csv") {
            // Prefer CSV but don't blank out existing CRM data
            for (const field of fields) {
              const csvVal = dup.csvRow[field.key];
              const csvEmpty = !csvVal || csvVal === "";
              choices[field.key] = csvEmpty ? "crm" : "csv";
            }
          } else {
            // Keep CRM but fill gaps from CSV
            for (const field of fields) {
              const crmVal = dup.crmRecord[field.key];
              const crmEmpty = crmVal === null || crmVal === undefined || crmVal === "";
              const csvVal = dup.csvRow[field.key];
              const csvEmpty = !csvVal || csvVal === "";
              choices[field.key] = (!crmEmpty) ? "crm" : (csvEmpty ? "crm" : "csv");
            }
          }
          updated.set(dup.crmId, { action: "overwrite", fieldChoices: choices });
        }
      }
      onResolutionsChange(updated);
    });
  }

  function toggleExpanded(crmId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(crmId)) next.delete(crmId);
      else next.add(crmId);
      return next;
    });
  }

  // Summary counts
  const counts = useMemo(() => {
    let skip = 0, update = 0, create = 0;
    for (const r of resolutions.values()) {
      if (r.action === "skip") skip++;
      else if (r.action === "overwrite") update++;
      else if (r.action === "create") create++;
    }
    return { skip, update, create };
  }, [resolutions]);

  const visibleDuplicates = duplicates.slice(0, visibleCount);
  const hasMore = visibleCount < duplicates.length;

  if (duplicates.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Bulk actions — prominent with active state */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm font-medium">For all {duplicates.length} duplicates:</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={bulkMode === "prefer_csv" ? "default" : "outline"}
            onClick={() => applyBulkDefault("prefer_csv")}
            disabled={isPending}
          >
            {isPending && bulkMode === "prefer_csv" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Update All — Prefer CSV
          </Button>
          <Button
            size="sm"
            variant={bulkMode === "keep_crm" ? "default" : "outline"}
            onClick={() => applyBulkDefault("keep_crm")}
            disabled={isPending}
          >
            {isPending && bulkMode === "keep_crm" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Update All — Fill Gaps Only
          </Button>
          <Button
            size="sm"
            variant={bulkMode === "skip" ? "default" : "outline"}
            onClick={() => applyBulkDefault("skip")}
            disabled={isPending}
          >
            {isPending && bulkMode === "skip" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Skip All
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {bulkMode === "prefer_csv" && "All records will be updated. CSV values take priority; existing CRM data is kept when CSV is empty."}
          {bulkMode === "keep_crm" && "All records will be updated. Existing CRM data is kept; CSV values only fill empty fields."}
          {bulkMode === "skip" && "All duplicates will be skipped. No records will be updated."}
          {!bulkMode && "Choose a bulk action, or customize per record below."}
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[10px]">
          {counts.skip} skip
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {counts.update} update
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {counts.create} create new
        </Badge>
      </div>

      {/* Individual duplicates — paginated */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {visibleDuplicates.map((dup) => {
          const resolution = resolutions.get(dup.crmId);
          const isExpanded = expandedIds.has(dup.crmId);

          // Count how many fields CSV can fill that CRM is missing
          const fillableCount = fields.filter((f) => {
            const crmVal = dup.crmRecord[f.key];
            const csvVal = dup.csvRow[f.key];
            const crmEmpty = crmVal === null || crmVal === undefined || crmVal === "";
            return crmEmpty && csvVal && csvVal !== "";
          }).length;

          return (
            <div key={dup.crmId} className="rounded-lg border">
              {/* Header row */}
              <div className="flex items-center gap-2 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {dup.crmName}
                    <span className="text-muted-foreground ml-2 text-xs">
                      (existing in CRM)
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    CSV: {dup.csvRow.firstName} {dup.csvRow.lastName}
                    {dup.csvRow.email ? ` — ${dup.csvRow.email}` : ""}
                    {dup.csvRow.companyName ? ` @ ${dup.csvRow.companyName}` : ""}
                  </p>
                  {fillableCount > 0 && resolution?.action === "overwrite" && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                      +{fillableCount} empty field{fillableCount > 1 ? "s" : ""} will be filled from CSV
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant={resolution?.action === "skip" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setAction(dup.crmId, "skip")}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant={resolution?.action === "overwrite" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setAction(dup.crmId, "overwrite")}
                  >
                    Update
                  </Button>
                  <Button
                    size="sm"
                    variant={resolution?.action === "create" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setAction(dup.crmId, "create")}
                  >
                    Create New
                  </Button>
                </div>

                {/* Expand toggle for field resolution */}
                {resolution?.action === "overwrite" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleExpanded(dup.crmId)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Field-by-field resolution (expanded) */}
              {resolution?.action === "overwrite" && isExpanded && (
                <div className="border-t px-3 py-2 space-y-1 bg-muted/30">
                  <div className="grid grid-cols-[120px_1fr_1fr_80px] gap-2 text-[10px] font-medium text-muted-foreground mb-1">
                    <span>Field</span>
                    <span>In CRM</span>
                    <span>In CSV</span>
                    <span>Keep</span>
                  </div>
                  {fields.map((field) => {
                    const crmVal = String(dup.crmRecord[field.key] ?? "");
                    const csvVal = dup.csvRow[field.key] ?? "";
                    const choice = resolution.fieldChoices[field.key] ?? "csv";
                    const isDifferent = crmVal !== csvVal && crmVal !== "" && csvVal !== "";
                    const isFillable = crmVal === "" && csvVal !== "";

                    return (
                      <div
                        key={field.key}
                        className={cn(
                          "grid grid-cols-[120px_1fr_1fr_80px] gap-2 items-center text-xs py-0.5",
                          isDifferent && "bg-yellow-50 dark:bg-yellow-900/10 -mx-1 px-1 rounded",
                          isFillable && "bg-green-50 dark:bg-green-900/10 -mx-1 px-1 rounded"
                        )}
                      >
                        <span className="text-muted-foreground truncate">{field.label}</span>
                        <span className="truncate">
                          {crmVal || <span className="text-muted-foreground italic">empty</span>}
                        </span>
                        <span className={cn("truncate", isFillable && "text-green-700 dark:text-green-400 font-medium")}>
                          {csvVal || <span className="text-muted-foreground italic">empty</span>}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px]",
                              choice === "crm"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                            onClick={() => setFieldChoice(dup.crmId, field.key, "crm")}
                          >
                            CRM
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px]",
                              choice === "csv"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                            onClick={() => setFieldChoice(dup.crmId, field.key, "csv")}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more / pagination */}
      {hasMore && (
        <div className="text-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, duplicates.length))}
          >
            Show more ({visibleCount} of {duplicates.length} shown)
          </Button>
        </div>
      )}
    </div>
  );
}
