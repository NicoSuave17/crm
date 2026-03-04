"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  DollarSign,
  AlertTriangle,
  CheckSquare,
  Kanban,
  Bell,
  Settings2,
  GripVertical,
  X,
} from "lucide-react";
import { useDashboard, useAlerts } from "@/lib/hooks/use-dashboard";
import { usePipelines } from "@/lib/hooks/use-pipeline";
import { formatCurrency } from "@/lib/utils/format";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Card Configuration ──────────────────────────────────────────

interface CardConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_CARDS: CardConfig[] = [
  { id: "totalContacts", label: "Total Contacts", visible: true },
  { id: "totalGmv", label: "GMV Under Mgmt", visible: true },
  { id: "atRisk", label: "At Risk", visible: true },
  { id: "tasksDue", label: "Tasks Due", visible: true },
  { id: "pipelineValue", label: "Pipeline Value", visible: true },
  { id: "unreadAlerts", label: "Unread Alerts", visible: true },
];

const STORAGE_KEY = "dashboard-card-config";

function loadCardConfig(): CardConfig[] {
  if (typeof window === "undefined") return DEFAULT_CARDS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CardConfig[];
      // Merge with defaults in case new cards are added in the future
      const storedIds = new Set(parsed.map((c) => c.id));
      const merged = [
        ...parsed,
        ...DEFAULT_CARDS.filter((c) => !storedIds.has(c.id)),
      ];
      return merged;
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CARDS;
}

// ─── Sortable Card Wrapper ───────────────────────────────────────

function SortableCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative group">
        <button
          {...listeners}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Alert Severity Colors ───────────────────────────────────────

const severityColors: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
};

// ─── Dashboard Page ──────────────────────────────────────────────

export default function DashboardPage() {
  // Filter state
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [pipelineId, setPipelineId] = useState("");

  // Card configuration state (localStorage-persisted)
  const [cardConfig, setCardConfig] = useState<CardConfig[]>(loadCardConfig);

  // Data hooks
  const { data: kpis, isLoading } = useDashboard({
    since: since || undefined,
    until: until || undefined,
    pipelineId: pipelineId || undefined,
  });
  const { data: recentAlerts } = useAlerts();
  const { data: pipelines } = usePipelines();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── Card Config Helpers ─────────────────────────────────────

  function saveCardConfig(config: CardConfig[]) {
    setCardConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cardConfig.findIndex((c) => c.id === active.id);
    const newIndex = cardConfig.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(cardConfig, oldIndex, newIndex);
    saveCardConfig(reordered);
  }

  // ─── Render Card by ID ───────────────────────────────────────

  function renderCard(cardId: string) {
    switch (cardId) {
      case "totalContacts":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Contacts
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {kpis?.totalContacts ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Creators & prospects
              </p>
            </CardContent>
          </Card>
        );
      case "totalGmv":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                GMV Under Mgmt
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(kpis?.totalGmv ?? 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Active creator portfolio
              </p>
            </CardContent>
          </Card>
        );
      case "atRisk":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">
                  {kpis?.atRiskCount ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Creators needing attention
              </p>
            </CardContent>
          </Card>
        );
      case "tasksDue":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tasks Due</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">
                  {kpis?.tasksDueToday ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Due today or overdue
              </p>
            </CardContent>
          </Card>
        );
      case "pipelineValue":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Pipeline Value
              </CardTitle>
              <Kanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(kpis?.pipelineValue ?? 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {kpis?.activeDeals ?? 0} active deals
              </p>
            </CardContent>
          </Card>
        );
      case "unreadAlerts":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Unread Alerts
              </CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">
                  {kpis?.unreadAlerts ?? 0}
                </div>
              )}
              <Link
                href="/alerts"
                className="text-xs text-primary hover:underline"
              >
                View all alerts
              </Link>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  }

  const visibleCards = cardConfig.filter((c) => c.visible);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your CRM activity and key metrics.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <p className="text-sm font-medium mb-3">Visible Cards</p>
            <div className="space-y-2">
              {cardConfig.map((card) => (
                <label
                  key={card.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={card.visible}
                    onCheckedChange={(checked) => {
                      const updated = cardConfig.map((c) =>
                        c.id === card.id ? { ...c, visible: !!checked } : c
                      );
                      saveCardConfig(updated);
                    }}
                  />
                  {card.label}
                </label>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => saveCardConfig(DEFAULT_CARDS)}
            >
              Reset to defaults
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Dashboard controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="w-[160px] h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="w-[160px] h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Pipeline</label>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="All pipelines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Pipelines</SelectItem>
              {pipelines?.map((p: { id: string; name: string }) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(since || until || pipelineId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSince("");
              setUntil("");
              setPipelineId("");
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* KPI Cards (drag-to-reorder, configurable visibility) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleCards.map((c) => c.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {visibleCards.map((card) => (
              <SortableCard key={card.id} id={card.id}>
                {renderCard(card.id)}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            Latest notifications requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recentAlerts || recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No alerts. Everything looks good.
            </p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.slice(0, 5).map(
                (alert: {
                  id: string;
                  type: string;
                  title: string;
                  message: string;
                  severity: string;
                  isRead: boolean;
                  contactFirstName: string | null;
                  contactLastName: string | null;
                  contactId: string | null;
                  createdAt: string;
                }) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0"
                  >
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 ${severityColors[alert.severity] ?? ""}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {alert.contactId && (
                          <Link
                            href={`/contacts/${alert.contactId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {alert.contactFirstName} {alert.contactLastName}
                          </Link>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                    {!alert.isRead && (
                      <Badge variant="secondary" className="text-[10px]">
                        New
                      </Badge>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
