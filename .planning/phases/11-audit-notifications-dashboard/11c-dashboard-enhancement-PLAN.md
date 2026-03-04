# Phase 11c: Dashboard Enhancement (Configurable Cards, Date Range, Pipeline Selector)

**Requirements:** DASH-01, DASH-02, DASH-03
**Scope:** Make dashboard KPI cards configurable (rearrange/hide), add a date range selector that filters metrics, and add a pipeline selector to scope deal-related metrics to a specific pipeline.
**Wave:** 1 (no dependencies on 11a or 11b)
**Depends on:** None (dashboard page, API, and hook all exist)

---

## Current State Assessment

### What exists:
- **Dashboard page** (`src/app/(dashboard)/dashboard/page.tsx`) -- Renders 6 hardcoded KPI cards (Total Contacts, GMV Under Mgmt, At Risk, Tasks Due, Pipeline Value, Unread Alerts) plus a Recent Alerts section. No date range or pipeline filtering. No ability to hide or rearrange cards.
- **Dashboard API** (`src/app/api/dashboard/route.ts`) -- GET handler that runs 6 parallel DB queries for KPIs. Returns `{ totalContacts, totalGmv, atRiskCount, tasksDueToday, pipelineValue, activeDeals, unreadAlerts }`. No date range or pipeline params.
- **Dashboard hook** (`src/lib/hooks/use-dashboard.ts`) -- `useDashboard()` query hook. Fetches `/api/dashboard` with 30s polling. No params support.
- **Pipeline hook** (`src/lib/hooks/use-pipeline.ts`) -- `usePipelines()` returns list of all pipelines. Can be used to populate pipeline selector.

### What needs to be built:
1. **Dashboard API** -- Accept `since`, `until`, `pipelineId` query params and scope queries accordingly
2. **Dashboard hook** -- Accept params and pass them to the API
3. **Dashboard page** -- Add date range selector + pipeline selector in the header area
4. **Card configuration** -- Store user's visible/hidden cards and card order in localStorage, with a settings popover to toggle cards and drag-to-reorder
5. **Card rearrangement** -- DnD reordering of KPI cards (project already has `@dnd-kit`)

---

## Implementation Steps

### Step 1: Add date range and pipeline params to Dashboard API
**File:** `src/app/api/dashboard/route.ts` (edit)

Accept `since`, `until`, and `pipelineId` from search params and apply them to the relevant queries.

**Date range filtering applies to:**
- `totalContacts` -- contacts created within the date range (using `contacts.createdAt`)
- `totalGmv` -- no change (GMV is a point-in-time metric, not scoped to a range)
- `atRiskCount` -- no change (at-risk is current state, not time-scoped)
- `tasksDueToday` -- no change (always shows today's tasks)
- `pipelineValue` / `activeDeals` -- deals created within the date range
- `unreadAlerts` -- no change (always shows current unread count)

Actually, applying date range to contacts and deals creation is the most useful interpretation for a dashboard. Users want to see "how many contacts were created this week" or "pipeline value added this month."

**Pipeline filtering applies to:**
- `pipelineValue` / `activeDeals` -- filter deals to specified pipeline

```ts
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const since = searchParams.get("since") ? new Date(searchParams.get("since")!) : undefined;
    const until = searchParams.get("until") ? new Date(searchParams.get("until")!) : undefined;
    const pipelineId = searchParams.get("pipelineId") || undefined;

    const isAM = user.role === "account_manager";
    const ownerFilter = isAM ? eq(contacts.ownerId, user.id) : undefined;

    // Build date conditions
    const contactDateFilters = [];
    if (ownerFilter) contactDateFilters.push(ownerFilter);
    if (since) contactDateFilters.push(gte(contacts.createdAt, since));
    if (until) contactDateFilters.push(lte(contacts.createdAt, until));

    const dealDateFilters = [];
    if (isAM) dealDateFilters.push(eq(deals.ownerId, user.id));
    if (since) dealDateFilters.push(gte(deals.createdAt, since));
    if (until) dealDateFilters.push(lte(deals.createdAt, until));
    if (pipelineId) dealDateFilters.push(eq(deals.pipelineId, pipelineId));

    const [
      contactStats,
      gmvStats,
      atRiskCount,
      tasksDueToday,
      dealStats,
      unreadAlerts,
    ] = await Promise.all([
      // Total contacts (scoped by date range)
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(contactDateFilters.length > 0 ? and(...contactDateFilters) : undefined),

      // Total GMV (current snapshot, not date-scoped)
      db
        .select({
          total: sql<string>`coalesce(sum(cast(${contacts.currentGmv} as numeric)), 0)`,
        })
        .from(contacts)
        .where(
          ownerFilter
            ? and(ownerFilter, eq(contacts.type, "creator"))
            : eq(contacts.type, "creator")
        ),

      // At-risk creators (current state, not date-scoped)
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(
          and(
            ownerFilter,
            eq(contacts.type, "creator"),
            or(
              eq(contacts.churnRisk, "high"),
              eq(contacts.churnRisk, "critical")
            )
          )
        ),

      // Tasks due today or overdue (always current)
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeId, user.id),
            eq(tasks.status, "pending"),
            lte(tasks.dueDate, new Date())
          )
        ),

      // Pipeline stats (scoped by date range + pipeline)
      db
        .select({
          totalValue: sql<string>`coalesce(sum(cast(${deals.value} as numeric)), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(deals)
        .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .where(
          and(
            eq(pipelineStages.isWon, false),
            eq(pipelineStages.isLost, false),
            ...(dealDateFilters.length > 0 ? dealDateFilters : [])
          )
        ),

      // Unread alerts (always current)
      db
        .select({ count: sql<number>`count(*)` })
        .from(alerts)
        .where(and(eq(alerts.userId, user.id), eq(alerts.isRead, false))),
    ]);

    return NextResponse.json({
      totalContacts: Number(contactStats[0].count),
      totalGmv: parseFloat(gmvStats[0].total),
      atRiskCount: Number(atRiskCount[0].count),
      tasksDueToday: Number(tasksDueToday[0].count),
      pipelineValue: parseFloat(dealStats[0].totalValue),
      activeDeals: Number(dealStats[0].count),
      unreadAlerts: Number(unreadAlerts[0].count),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**New import needed:** `gte` from `drizzle-orm` (add to existing import). Also import `NextRequest` (change from no-param to `request: NextRequest`).

### Step 2: Update useDashboard hook to accept params
**File:** `src/lib/hooks/use-dashboard.ts` (edit)

```ts
export function useDashboard(params: {
  since?: string;
  until?: string;
  pipelineId?: string;
} = {}) {
  return useQuery({
    queryKey: ["dashboard", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.since) searchParams.set("since", params.since);
      if (params.until) searchParams.set("until", params.until);
      if (params.pipelineId) searchParams.set("pipelineId", params.pipelineId);
      const qs = searchParams.toString();
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000,
  });
}
```

### Step 3: Add date range and pipeline selector UI to dashboard page
**File:** `src/app/(dashboard)/dashboard/page.tsx` (edit)

Add a controls bar between the page header and the KPI cards grid.

**New state:**
```ts
const [since, setSince] = useState("");
const [until, setUntil] = useState("");
const [pipelineId, setPipelineId] = useState("");
```

**Updated hook call:**
```ts
const { data: kpis, isLoading } = useDashboard({
  since: since || undefined,
  until: until || undefined,
  pipelineId: pipelineId || undefined,
});
```

**New imports:**
```ts
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { usePipelines } from "@/lib/hooks/use-pipeline";
import { Filter, X } from "lucide-react";
```

**Fetch pipelines:**
```ts
const { data: pipelines } = usePipelines();
```

**Controls bar JSX (placed after the page header div, before the KPI cards grid):**
```tsx
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
```

### Step 4: Implement configurable KPI cards (rearrange/hide)
**File:** `src/app/(dashboard)/dashboard/page.tsx` (edit)

This is the most complex part. We need:
1. A card configuration stored in localStorage
2. A settings popover to toggle card visibility
3. Drag-to-reorder cards using @dnd-kit

**Card configuration data model:**

```ts
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
```

**State management with localStorage persistence:**

```ts
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
  } catch {}
  return DEFAULT_CARDS;
}

const [cardConfig, setCardConfig] = useState<CardConfig[]>(loadCardConfig);

function saveCardConfig(config: CardConfig[]) {
  setCardConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

**Card visibility toggle (settings popover):**

Add a Settings/Gear icon button next to the page title that opens a Popover:

```tsx
import { Settings2, GripVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
```

```tsx
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
```

**Drag-to-reorder with @dnd-kit:**

The project already uses `@dnd-kit` (per MEMORY.md). Add drag-to-reorder to the card grid.

```tsx
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
```

**SortableCard wrapper component:**

```tsx
function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
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
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {children}
      </div>
    </div>
  );
}
```

**Refactor KPI cards grid:**

Replace the two hardcoded grid sections with a single DnD-enabled grid that renders only visible cards in config order.

Create a `renderCard(cardId: string)` function that returns the appropriate Card JSX for each card ID:

```tsx
function renderCard(cardId: string) {
  switch (cardId) {
    case "totalContacts":
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{kpis?.totalContacts ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Creators & prospects</p>
          </CardContent>
        </Card>
      );
    case "totalGmv":
      // ... GMV card
    case "atRisk":
      // ... At Risk card
    case "tasksDue":
      // ... Tasks Due card
    case "pipelineValue":
      // ... Pipeline Value card (use lg:col-span-1 instead of lg:col-span-2)
    case "unreadAlerts":
      // ... Unread Alerts card (use lg:col-span-1 instead of lg:col-span-2)
    default:
      return null;
  }
}
```

**Note on col-span:** The current layout uses `lg:col-span-2` for Pipeline Value and Unread Alerts to fill the second row. With configurable cards where any card can be in any position, we should use uniform `col-span-1` for all cards in a responsive 4-column grid. This keeps the layout predictable regardless of card arrangement.

**DnD-wrapped grid:**

```tsx
const visibleCards = cardConfig.filter((c) => c.visible);
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = cardConfig.findIndex((c) => c.id === active.id);
  const newIndex = cardConfig.findIndex((c) => c.id === over.id);
  const reordered = arrayMove(cardConfig, oldIndex, newIndex);
  saveCardConfig(reordered);
}

// In JSX:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={visibleCards.map((c) => c.id)} strategy={rectSortingStrategy}>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {visibleCards.map((card) => (
        <SortableCard key={card.id} id={card.id}>
          {renderCard(card.id)}
        </SortableCard>
      ))}
    </div>
  </SortableContext>
</DndContext>
```

**Remove the second grid row (Pipeline Value + Unread Alerts in lg:col-span-2)**. All 6 cards now live in a single grid, rendered in config order. With 4 columns and 6 cards, this creates a clean 4+2 layout by default, or fewer rows if cards are hidden.

### Step 5: Wire everything together in the full page component
**File:** `src/app/(dashboard)/dashboard/page.tsx` (edit -- full rewrite)

The page structure becomes:

```
Page header (title + Customize button)
Controls bar (date range + pipeline selector)
DnD card grid (sortable, configurable visibility)
Recent Alerts section (unchanged)
```

All state (date range, pipeline, card config) lives at the page component level. The `renderCard` function is a helper inside the component that closes over `kpis` and `isLoading`.

**Full list of new imports needed:**
- `Input` from `@/components/ui/input`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
- `Button` from `@/components/ui/button`
- `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`
- `Checkbox` from `@/components/ui/checkbox`
- `Settings2`, `GripVertical`, `X` from `lucide-react`
- `usePipelines` from `@/lib/hooks/use-pipeline`
- `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors`, `DragEndEvent` from `@dnd-kit/core`
- `SortableContext`, `useSortable`, `rectSortingStrategy`, `arrayMove` from `@dnd-kit/sortable`
- `CSS` from `@dnd-kit/utilities`

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| DASH-01 | User can rearrange/hide KPI cards on dashboard | Step 4 (drag-to-reorder with @dnd-kit, visibility toggles in Customize popover, localStorage persistence) |
| DASH-02 | Date range selector filters dashboard metrics | Steps 1-3 (API accepts since/until, hook passes params, UI has date inputs that scope contacts + deals queries) |
| DASH-03 | Pipeline selector filters dashboard to specific pipeline | Steps 1-3 (API accepts pipelineId, hook passes param, UI has pipeline dropdown that scopes deal queries) |

---

## Risks & Decisions

### Date range interpretation: "created within range" vs. "current state as of date"
**Decision: Created within range.** When a user selects a date range, `totalContacts` shows contacts created within that range, and `pipelineValue`/`activeDeals` shows deals created within that range. GMV, At Risk, Tasks Due, and Unread Alerts remain unscoped because they represent current state (not historical snapshots). This is the most useful interpretation for an internal CRM -- users want to see "what happened this week" rather than "what the state was on date X."

### localStorage vs. server-side card config
**Decision: localStorage.** Card arrangement/visibility is a user preference, not business data. Storing it in localStorage keeps it simple, avoids DB schema changes, and works instantly. The downside is that preferences don't roam across devices -- acceptable for an internal tool where users typically use one workstation.

### All cards same size vs. variable col-span
**Decision: Uniform col-span-1 in a 4-column grid.** The current layout has Pipeline Value and Unread Alerts spanning 2 columns each. With drag-to-reorder, variable spans would create unpredictable layouts (e.g., what happens when a 2-span card is dragged to position 3 of 4?). Uniform sizing gives a clean, predictable grid. If a user hides 2 cards, they get a clean 4-card single row.

### @dnd-kit imports
The project already uses `@dnd-kit` for Kanban drag-to-reorder (pipeline stages use it). The required packages (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) should already be in `package.json`. Verify before implementation with `npm ls @dnd-kit/core`.

### DragOverlay
For simplicity, this plan uses the basic `useSortable` approach without a `DragOverlay`. The card just becomes semi-transparent (opacity 0.5) while dragging. If the visual feedback feels insufficient, a `DragOverlay` can be added later to show a floating card clone during drag.

### Checkbox component
The plan assumes `@/components/ui/checkbox` exists (standard shadcn/ui component). If it has not been installed yet, run `npx shadcn@latest add checkbox` before implementation.

### Pipeline selector showing "All Pipelines" by default
The `Select` component uses an empty string value for "All Pipelines". When `pipelineId` is empty string, it is treated as falsy and not sent to the API. This ensures the default behavior (no pipeline filter) matches the pre-enhancement behavior.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to dashboard -- all 6 KPI cards display as before (default config)
3. **Date range:** Set "From" to 7 days ago -- "Total Contacts" and "Pipeline Value" / "Active Deals" reflect only data from the last 7 days. GMV, At Risk, Tasks Due, Unread Alerts remain unchanged.
4. **Date range:** Set "To" to yesterday -- same scoping behavior with an upper bound
5. **Date range:** Click "Clear" -- all filters reset, full data shown
6. **Pipeline selector:** Select a specific pipeline -- "Pipeline Value" and "Active Deals" reflect only that pipeline's deals. Other cards unaffected.
7. **Pipeline + date range:** Combine both filters -- deal cards respect both constraints
8. **Customize button:** Click "Customize" -- popover shows all 6 cards with checkboxes
9. **Hide a card:** Uncheck "At Risk" -- the At Risk card disappears from the grid. Grid reflows.
10. **Show a card:** Re-check "At Risk" -- card reappears
11. **Reorder:** Hover over a card -- grip icon appears in top-right. Drag a card to a new position -- card moves, grid reflows. The new order persists after page refresh (localStorage).
12. **Reset:** Click "Reset to defaults" in Customize popover -- all cards visible, original order restored
13. **Persistence:** Refresh the page -- card configuration (visibility + order) persists from localStorage
14. **Recent Alerts section:** Remains unchanged and visible below the KPI card grid
15. No console errors throughout all interactions
