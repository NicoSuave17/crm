# Phase 11c: Dashboard Enhancement - SUMMARY

**Status:** Complete
**Completed:** 2026-03-05

## What Was Built

### 1. Dashboard API Date Range + Pipeline Params (Step 1)
**File:** `src/app/api/dashboard/route.ts`

- Accepts `since`, `until`, `pipelineId` query parameters
- Date range scopes `totalContacts` (by createdAt) and `pipelineValue`/`activeDeals` (by deal createdAt)
- Pipeline ID scopes `pipelineValue`/`activeDeals` to a specific pipeline
- GMV, At Risk, Tasks Due, Unread Alerts remain unscoped (current state metrics)
- Changed function signature from `GET()` to `GET(request: NextRequest)` for URL parsing

### 2. useDashboard Hook Params (Step 2)
**File:** `src/lib/hooks/use-dashboard.ts`

- `useDashboard()` now accepts `{ since?, until?, pipelineId? }` params object
- Builds URLSearchParams and appends to fetch URL
- Query key includes params for automatic cache invalidation on filter change
- 30s polling preserved

### 3. Dashboard Page Rewrite (Steps 3-5)
**File:** `src/app/(dashboard)/dashboard/page.tsx`

**Date Range Selector:**
- From/To date inputs that filter contacts and deal metrics
- Clear button appears when any filter is active

**Pipeline Selector:**
- Dropdown populated from `usePipelines()` hook
- "All Pipelines" default, selects specific pipeline to scope deal KPIs

**Configurable Card Visibility:**
- Customize button with Settings2 icon opens Popover
- Checkbox per KPI card to toggle visibility
- "Reset to defaults" button restores all cards visible in original order

**Drag-to-Reorder Cards:**
- @dnd-kit SortableContext with rectSortingStrategy
- GripVertical drag handle appears on card hover (top-right)
- PointerSensor with 5px distance activation constraint
- Cards become semi-transparent (opacity 0.5) during drag

**localStorage Persistence:**
- Card config (order + visibility) stored in `dashboard-card-config` key
- Survives page refresh; merges with defaults if new cards added later

**Layout Changes:**
- Unified 4-column grid (removed lg:col-span-2 from Pipeline Value and Unread Alerts)
- All cards now uniform size for predictable DnD reordering
- Recent Alerts section unchanged below KPI grid

## Requirements Covered

| Requirement | Description | Status |
|-------------|-------------|--------|
| DASH-01 | Rearrange/hide KPI cards on dashboard | Done |
| DASH-02 | Date range selector filters dashboard metrics | Done |
| DASH-03 | Pipeline selector filters dashboard to specific pipeline | Done |

## Files Changed
- `src/app/api/dashboard/route.ts` -- Added query param parsing and conditional filters
- `src/lib/hooks/use-dashboard.ts` -- Added params support to useDashboard
- `src/app/(dashboard)/dashboard/page.tsx` -- Full rewrite with filters, DnD, configurable cards

## Commits
1. `feat(11c-dashboard): task 1 - add date range and pipeline params to Dashboard API`
2. `feat(11c-dashboard): task 2 - update useDashboard hook to accept params`
3. `feat(11c-dashboard): task 3 - configurable dashboard with filters and DnD cards`
