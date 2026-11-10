"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/lib/admin/column-registry";

interface DynamicTableProps {
  columns: ColumnDef[];
  visibleColumns: string[];
  data: Record<string, unknown>[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
  onToggleColumn?: (key: string) => void;
  columnWidths?: Record<string, number>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
  idField?: string;
  renderCell?: (column: ColumnDef, row: Record<string, unknown>) => React.ReactNode;
}

export function DynamicTable({
  columns,
  visibleColumns,
  data,
  sortBy,
  sortDir,
  onSort,
  onToggleColumn,
  columnWidths,
  selectable,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isSomeSelected,
  idField = "id",
  renderCell,
}: DynamicTableProps) {
  const activeColumns = columns.filter((c) => visibleColumns.includes(c.key));

  function formatValue(col: ColumnDef, value: unknown): React.ReactNode {
    if (value == null) return <span className="text-muted-foreground">—</span>;

    switch (col.type) {
      case "currency": {
        const num = typeof value === "string" ? parseFloat(value) : Number(value);
        if (isNaN(num)) return "—";
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(num);
      }
      case "date": {
        const d = new Date(String(value));
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      case "boolean":
        return value ? "Yes" : "No";
      case "badge":
        return (
          <Badge variant="outline" className="capitalize text-xs">
            {String(value).replace(/_/g, " ")}
          </Badge>
        );
      case "enum":
        return (
          <span className="capitalize text-sm">
            {String(value).replace(/_/g, " ")}
          </span>
        );
      case "number":
        return String(value);
      default:
        return String(value);
    }
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    isAllSelected ? true : isSomeSelected ? "indeterminate" : false
                  }
                  onCheckedChange={() => onToggleSelectAll?.()}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {activeColumns.map((col) => (
              <TableHead
                key={col.key}
                style={{
                  width: columnWidths?.[col.key] ?? col.defaultWidth,
                  minWidth: 80,
                }}
              >
                <div className="flex items-center gap-1">
                  {col.sortable && onSort ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.label}
                      {sortBy === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                  {onToggleColumn && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onToggleColumn(col.key)}>
                          Hide Column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={activeColumns.length + (selectable ? 1 : 0)}
                className="h-24 text-center text-muted-foreground"
              >
                No data found.
              </TableCell>
            </TableRow>
          )}
          {data.map((row, idx) => {
            const rowId = String(row[idField] ?? idx);
            return (
              <TableRow
                key={rowId}
                data-selected={selectedIds?.has(rowId) || undefined}
              >
                {selectable && (
                  <TableCell className="w-[40px]">
                    <Checkbox
                      checked={selectedIds?.has(rowId)}
                      onCheckedChange={() => onToggleSelect?.(rowId)}
                    />
                  </TableCell>
                )}
                {activeColumns.map((col) => (
                  <TableCell key={col.key}>
                    {renderCell
                      ? renderCell(col, row) ?? formatValue(col, row[col.key])
                      : formatValue(col, row[col.key])}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Column visibility control component
export function ColumnToggle({
  columns,
  visibleColumns,
  onToggle,
}: {
  columns: ColumnDef[];
  visibleColumns: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto">
        {columns.map((col) => (
          <DropdownMenuItem
            key={col.key}
            onClick={(e) => {
              e.preventDefault();
              onToggle(col.key);
            }}
          >
            <Checkbox
              checked={visibleColumns.includes(col.key)}
              className="mr-2"
            />
            {col.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
