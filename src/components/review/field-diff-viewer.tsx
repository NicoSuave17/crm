"use client";

import { cn } from "@/lib/utils";

interface FieldDiffViewerProps {
  incomingData: Record<string, unknown>;
  existingRecord?: Record<string, unknown> | null;
  normalizedData?: Record<string, unknown> | null;
  fieldDecisions?: { field: string; originalValue: unknown; normalizedValue: unknown; reason: string }[];
}

export function FieldDiffViewer({
  incomingData,
  existingRecord,
  normalizedData,
  fieldDecisions = [],
}: FieldDiffViewerProps) {
  const allFields = new Set([
    ...Object.keys(incomingData),
    ...(existingRecord ? Object.keys(existingRecord) : []),
    ...(normalizedData ? Object.keys(normalizedData) : []),
  ]);

  // Filter out system/internal fields
  const displayFields = [...allFields].filter(
    (f) => !["id", "crmId", "createdAt", "updatedAt", "_entityId"].includes(f)
  );

  const decisionMap = new Map(fieldDecisions.map((d) => [d.field, d]));

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 border-b">
        <div>Field</div>
        <div>Incoming</div>
        {existingRecord && <div>Existing</div>}
        <div>Normalized</div>
      </div>
      {displayFields.map((field) => {
        const incoming = incomingData[field];
        const existing = existingRecord?.[field];
        const normalized = normalizedData?.[field];
        const decision = decisionMap.get(field);

        const hasChange =
          (normalized !== undefined && String(normalized) !== String(incoming)) ||
          (existing !== undefined && String(existing) !== String(incoming));

        return (
          <div
            key={field}
            className={cn(
              "grid gap-2 text-xs px-2 py-1.5 rounded",
              existingRecord ? "grid-cols-4" : "grid-cols-3",
              hasChange ? "bg-amber-50 dark:bg-amber-950/20" : ""
            )}
          >
            <div className="font-medium text-muted-foreground truncate">{field}</div>
            <div className="truncate">{formatValue(incoming)}</div>
            {existingRecord && (
              <div className="truncate text-muted-foreground">{formatValue(existing)}</div>
            )}
            <div className="truncate">
              {normalized !== undefined && String(normalized) !== String(incoming) ? (
                <span className="text-blue-600 dark:text-blue-400" title={decision?.reason}>
                  {formatValue(normalized)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
