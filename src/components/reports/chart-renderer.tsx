"use client";

import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Funnel, FunnelChart,
} from "recharts";
import type { ChartConfigType } from "@/lib/validators/report";

import { CHART_COLORS } from "@/lib/constants/brand-colors";

const DEFAULT_COLORS = [...CHART_COLORS];

interface ChartRendererProps {
  config: ChartConfigType;
  data: Record<string, unknown>[];
  height?: number;
}

export function ChartRenderer({ config, data, height = 300 }: ChartRendererProps) {
  const colors = config.colors ?? DEFAULT_COLORS;
  const xKey = config.xAxis ?? "label";
  const yKeys = config.yAxis ?? ["value"];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data to display
      </div>
    );
  }

  switch (config.type) {
    case "bar":
    case "stacked_bar":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            {config.showLegend !== false && <Legend />}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                stackId={config.stacked || config.type === "stacked_bar" ? "stack" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            {config.showLegend !== false && <Legend />}
            {yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            {config.showLegend !== false && <Legend />}
            {yKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={colors[i % colors.length]}
                stroke={colors[i % colors.length]}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case "pie":
    case "donut":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              innerRadius={config.type === "donut" ? height / 5 : 0}
              label={config.showLabels !== false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            {config.showLegend !== false && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      );

    case "scatter":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis dataKey={yKeys[0]} className="text-xs" />
            <Tooltip />
            <Scatter data={data} fill={colors[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case "funnel":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <FunnelChart>
            <Tooltip />
            <Funnel
              dataKey={yKeys[0]}
              data={data.map((d, i) => ({
                ...d,
                fill: colors[i % colors.length],
              }))}
              isAnimationActive
            />
          </FunnelChart>
        </ResponsiveContainer>
      );

    case "number_card": {
      const value = data[0]?.[yKeys[0]];
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : String(value ?? "—")}
          </div>
          {config.xAxis && (
            <div className="text-sm text-muted-foreground mt-1">
              {String(data[0]?.[config.xAxis] ?? "")}
            </div>
          )}
        </div>
      );
    }

    case "gauge": {
      const val = Number(data[0]?.[yKeys[0]] ?? 0);
      const percent = Math.min(Math.max(val, 0), 100);
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 100 50" className="w-full">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="currentColor"
                className="text-muted"
                strokeWidth="8"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={colors[0]}
                strokeWidth="8"
                strokeDasharray={`${percent * 1.26} 126`}
              />
            </svg>
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <span className="text-2xl font-bold">{val}%</span>
            </div>
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Unsupported chart type: {config.type}
        </div>
      );
  }
}
