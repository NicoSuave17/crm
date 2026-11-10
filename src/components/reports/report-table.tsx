"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportTableProps {
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  aggregates?: Record<string, unknown>;
  groupedData?: {
    groupKey: Record<string, unknown>;
    rows: Record<string, unknown>[];
    aggregates: Record<string, unknown>;
  }[];
}

export function ReportTable({
  columns,
  rows,
  aggregates,
  groupedData,
}: ReportTableProps) {
  function formatValue(value: unknown, type: string): string {
    if (value == null) return "—";
    if (type === "currency") {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(num);
    }
    if (type === "date") {
      const d = new Date(String(value));
      return isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    if (type === "number") {
      const num = Number(value);
      return isNaN(num) ? String(value) : num.toLocaleString();
    }
    if (type === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  if (groupedData && groupedData.length > 0) {
    return (
      <div className="space-y-4">
        {groupedData.map((group, gi) => (
          <div key={gi} className="rounded-md border">
            <div className="bg-muted/50 px-4 py-2 text-sm font-medium">
              {Object.entries(group.groupKey)
                .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
                .join(" | ")}
            </div>
            <Table>
              <TableBody>
                {Object.entries(group.aggregates).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>{String(val)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        {aggregates && (
          <div className="rounded-md border border-primary/20">
            <div className="bg-primary/5 px-4 py-2 text-sm font-semibold">
              Grand Total
            </div>
            <Table>
              <TableBody>
                {Object.entries(aggregates).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>{String(val)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No results
              </TableCell>
            </TableRow>
          )}
          {rows.map((row, ri) => (
            <TableRow key={ri}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {formatValue(row[col.key], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
