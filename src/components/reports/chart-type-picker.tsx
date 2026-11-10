"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Circle,
  Hash,
  Layers,
  Gauge,
  ScatterChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CHART_TYPES: {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  { value: "bar", label: "Bar", icon: BarChart3, description: "Compare values across categories" },
  { value: "stacked_bar", label: "Stacked Bar", icon: Layers, description: "Compare segmented values" },
  { value: "line", label: "Line", icon: LineChart, description: "Show trends over time" },
  { value: "area", label: "Area", icon: TrendingUp, description: "Filled trend chart" },
  { value: "pie", label: "Pie", icon: PieChart, description: "Part-of-whole distribution" },
  { value: "donut", label: "Donut", icon: Circle, description: "Pie with center cutout" },
  { value: "funnel", label: "Funnel", icon: TrendingUp, description: "Stage-based conversion" },
  { value: "scatter", label: "Scatter", icon: ScatterChart, description: "Two-variable correlation" },
  { value: "gauge", label: "Gauge", icon: Gauge, description: "Single KPI with threshold" },
  { value: "number_card", label: "Number", icon: Hash, description: "Single big metric" },
];

interface ChartTypePickerProps {
  value: string | null;
  onChange: (type: string | null) => void;
}

export function ChartTypePicker({ value, onChange }: ChartTypePickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.value}
            type="button"
            onClick={() => onChange(value === ct.value ? null : ct.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors hover:border-primary/50",
              value === ct.value
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted text-muted-foreground"
            )}
          >
            <ct.icon className="h-5 w-5" />
            <span className="font-medium">{ct.label}</span>
          </button>
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          {CHART_TYPES.find((ct) => ct.value === value)?.description}
        </p>
      )}
    </div>
  );
}
