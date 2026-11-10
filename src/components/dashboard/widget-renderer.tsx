"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartRenderer } from "@/components/reports/chart-renderer";
import { useExecuteReport } from "@/lib/hooks/use-reports";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ChartConfigType } from "@/lib/validators/report";

interface WidgetConfig {
  id: string;
  type: "kpi" | "chart" | "activities" | "tasks" | "pipeline" | "leaderboard" | "alerts";
  title: string;
  reportId?: string;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
}

interface WidgetRendererProps {
  widget: WidgetConfig;
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  switch (widget.type) {
    case "kpi":
      return <KpiWidget widget={widget} />;
    case "chart":
      return <ChartWidget widget={widget} />;
    default:
      return (
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{widget.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[calc(100%-3rem)]">
            <p className="text-sm text-muted-foreground">
              {widget.type} widget
            </p>
          </CardContent>
        </Card>
      );
  }
}

function KpiWidget({ widget }: { widget: WidgetConfig }) {
  const { data: result, isLoading } = useExecuteReport(widget.reportId ?? "");

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  const value = result?.rows?.[0]
    ? Object.values(result.rows[0])[0]
    : null;

  const trend = widget.config?.trend as number | undefined;
  const TrendIcon =
    trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend && trend > 0
      ? "text-[#00876D]"
      : trend && trend < 0
        ? "text-[#E86644]"
        : "text-muted-foreground";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value != null
            ? typeof value === "number"
              ? value.toLocaleString()
              : String(value)
            : "—"}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartWidget({ widget }: { widget: WidgetConfig }) {
  const { data: result, isLoading } = useExecuteReport(widget.reportId ?? "");

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-full w-full min-h-32" />
        </CardContent>
      </Card>
    );
  }

  const chartConfig = widget.config?.chart as ChartConfigType | undefined;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-3rem)]">
        {chartConfig && result?.rows ? (
          <ChartRenderer config={chartConfig} data={result.rows} height={200} />
        ) : (
          <p className="text-sm text-muted-foreground">No chart configured</p>
        )}
      </CardContent>
    </Card>
  );
}

export type { WidgetConfig };
