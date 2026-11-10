"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, GripVertical } from "lucide-react";
import type { WidgetConfig } from "@/components/dashboard/widget-renderer";

const WIDGET_TYPES = [
  { value: "kpi", label: "KPI Card", description: "Single metric with trend" },
  { value: "chart", label: "Chart", description: "Report chart visualization" },
  { value: "activities", label: "Recent Activities", description: "Activity feed" },
  { value: "tasks", label: "Task List", description: "Pending/overdue tasks" },
  { value: "pipeline", label: "Pipeline Summary", description: "Stage overview" },
  { value: "leaderboard", label: "Leaderboard", description: "Ranked user metrics" },
  { value: "alerts", label: "Alert Feed", description: "Unread alerts" },
];

interface DashboardConfiguratorProps {
  widgets: WidgetConfig[];
  onChange: (widgets: WidgetConfig[]) => void;
}

export function DashboardConfigurator({
  widgets,
  onChange,
}: DashboardConfiguratorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newWidget, setNewWidget] = useState({
    type: "kpi",
    title: "",
    reportId: "",
    width: 3,
    height: 2,
  });

  function addWidget() {
    const widget: WidgetConfig = {
      id: `widget_${Date.now()}`,
      type: newWidget.type as WidgetConfig["type"],
      title: newWidget.title || "New Widget",
      reportId: newWidget.reportId || undefined,
      config: {},
      layout: {
        x: 0,
        y: widgets.length * 2,
        w: newWidget.width,
        h: newWidget.height,
      },
    };
    onChange([...widgets, widget]);
    setAddOpen(false);
    setNewWidget({ type: "kpi", title: "", reportId: "", width: 3, height: 2 });
  }

  function removeWidget(id: string) {
    onChange(widgets.filter((w) => w.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Dashboard Widgets</Label>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Add Widget
        </Button>
      </div>

      {widgets.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
          No widgets. Add one to build the dashboard.
        </p>
      )}

      <div className="space-y-2">
        {widgets.map((widget) => (
          <Card key={widget.id} className="p-0">
            <div className="flex items-center gap-3 px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{widget.title}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {widget.type} · {widget.layout.w}×{widget.layout.h}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeWidget(widget.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Widget Type</Label>
              <Select value={newWidget.type} onValueChange={(v) => setNewWidget({ ...newWidget, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((wt) => (
                    <SelectItem key={wt.value} value={wt.value}>
                      {wt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={newWidget.title}
                onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                placeholder="Widget title"
              />
            </div>
            {(newWidget.type === "kpi" || newWidget.type === "chart") && (
              <div>
                <Label>Report ID (optional)</Label>
                <Input
                  value={newWidget.reportId}
                  onChange={(e) => setNewWidget({ ...newWidget, reportId: e.target.value })}
                  placeholder="Paste report ID"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Width (columns, max 12)</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={newWidget.width}
                  onChange={(e) => setNewWidget({ ...newWidget, width: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Height (rows)</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={newWidget.height}
                  onChange={(e) => setNewWidget({ ...newWidget, height: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addWidget}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
