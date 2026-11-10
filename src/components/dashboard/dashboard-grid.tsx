"use client";

import { WidgetRenderer, type WidgetConfig } from "./widget-renderer";

interface DashboardGridProps {
  widgets: WidgetConfig[];
}

export function DashboardGrid({ widgets }: DashboardGridProps) {
  if (widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 border border-dashed rounded-lg text-muted-foreground text-sm">
        No widgets configured for this dashboard. An admin can configure them in Settings.
      </div>
    );
  }

  // Simple CSS grid layout — each widget gets a cell based on its layout config
  // Grid is 12 columns wide
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(12, 1fr)",
      }}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          style={{
            gridColumn: `span ${widget.layout.w}`,
            minHeight: widget.layout.h * 100,
          }}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  );
}
