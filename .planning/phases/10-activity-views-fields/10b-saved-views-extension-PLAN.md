# Phase 10b: Saved Views Extension

**Requirements:** VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05
**Scope:** Extend the saved views system (currently only on contacts page) to deals, tasks, and companies list pages. Add delete button to the saved views bar. Ensure views store entity type, filters, sort, and column visibility.
**Wave:** 1 (no dependencies outside existing codebase)
**Depends on:** None (saved views backend fully exists, contacts page has working reference implementation)

---

## Current State Assessment

### What exists:
- **Saved views backend** -- Fully built:
  - DAL (`src/lib/api/saved-views.ts`) -- `listSavedViews`, `createSavedView`, `updateSavedView`, `deleteSavedView`
  - API routes (`src/app/api/saved-views/route.ts`, `src/app/api/saved-views/[id]/route.ts`) -- GET, POST, PATCH, DELETE
  - Schema (`src/lib/db/schema.ts`) -- `savedViews` table with `entityType` (enum: contact, deal, company, task), `filters` (jsonb), `sortBy` (jsonb), `columns` (jsonb), `userId`, `isShared`
  - Hooks (`src/lib/hooks/use-saved-views.ts`) -- `useSavedViews(entityType)`, `useCreateSavedView()`, `useDeleteSavedView()`

- **Contacts page** (`src/app/(dashboard)/contacts/page.tsx`) -- Full saved views implementation:
  - Saved views bar with `Bookmark` icon and view buttons
  - "Save View" button (floppy disk icon) in filters bar
  - Save View dialog with name input
  - `handleLoadView()` function that parses filters and sets search/typeFilter/statusFilter
  - `handleSaveView()` captures current search + type + status as filter objects
  - Uses `useSavedViews("contact")`, `useCreateSavedView()`, `useDeleteSavedView()` (delete is imported but NOT wired to any UI -- no delete button exists)

- **Deals page** (`src/app/(dashboard)/deals/page.tsx`) -- No saved views. No filters (no search, no filter controls). Only has a table with dropdown actions.

- **Tasks page** (`src/app/(dashboard)/tasks/page.tsx`) -- No saved views. Has a status filter dropdown only.

- **Companies page** (`src/app/(dashboard)/companies/page.tsx`) -- No saved views. Has search, size filter, and industry filter.

### What needs to be built:
1. Add delete button to the saved views bar (contacts page first, then replicate to other pages)
2. Add saved views bar + save dialog + load/save logic to deals page
3. Add saved views bar + save dialog + load/save logic to tasks page
4. Add saved views bar + save dialog + load/save logic to companies page

---

## Implementation Steps

### Step 1: Add delete button to contacts page saved views bar
**File:** `src/app/(dashboard)/contacts/page.tsx` (edit)

The contacts page already imports `useDeleteSavedView` but has no delete UI. Add an X button to each saved view chip in the views bar.

**Current saved views bar:**
```tsx
{savedViews.map((view) => (
  <Button key={view.id} variant="outline" size="sm" className="text-xs h-7"
    onClick={() => handleLoadView(view)}>
    {view.name}
  </Button>
))}
```

**Updated saved views bar with delete:**
```tsx
{savedViews.map((view: { id: string; name: string; filters: Record<string, unknown>[] }) => (
  <div key={view.id} className="flex items-center gap-0.5">
    <Button
      variant="outline"
      size="sm"
      className="text-xs h-7 rounded-r-none"
      onClick={() => handleLoadView(view)}
    >
      {view.name}
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="text-xs h-7 px-1.5 rounded-l-none border-l-0"
      onClick={() => {
        deleteView.mutate(view.id, {
          onSuccess: () => toast.success("View deleted"),
          onError: () => toast.error("Failed to delete view"),
        });
      }}
    >
      <X className="h-3 w-3" />
    </Button>
  </div>
))}
```

**Import to add:** `X` from `lucide-react`.

This creates a compound button where the view name loads the view and the small X deletes it. The `rounded-r-none` / `rounded-l-none` + `border-l-0` creates a visually connected button pair.

### Step 2: Create a reusable SavedViewsBar component
**File:** `src/components/saved-views/saved-views-bar.tsx` (new)

To avoid duplicating the saved views bar, save dialog, and load/save/delete logic across 4 pages, extract a reusable component.

**Props:**
```ts
interface SavedViewsBarProps {
  entityType: "contact" | "deal" | "company" | "task";
  currentFilters: Record<string, unknown>[];
  onLoadView: (filters: Record<string, unknown>[]) => void;
}
```

**Implementation:**
```tsx
"use client";

import { useState } from "react";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Bookmark, Save, X } from "lucide-react";
import { toast } from "sonner";

export function SavedViewsBar({ entityType, currentFilters, onLoadView }: SavedViewsBarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const { data: savedViews } = useSavedViews(entityType);
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!viewName.trim()) return;
    createView.mutate(
      { name: viewName.trim(), entityType, filters: currentFilters },
      {
        onSuccess: () => {
          toast.success("View saved");
          setSaveOpen(false);
          setViewName("");
        },
        onError: () => toast.error("Failed to save view"),
      }
    );
  }

  return (
    <>
      {/* Views bar -- only render if views exist */}
      {savedViews && savedViews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
          {savedViews.map((view: { id: string; name: string; filters: Record<string, unknown>[] }) => (
            <div key={view.id} className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 rounded-r-none"
                onClick={() => onLoadView(view.filters)}
              >
                {view.name}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-1.5 rounded-l-none border-l-0"
                onClick={() => {
                  deleteView.mutate(view.id, {
                    onSuccess: () => toast.success("View deleted"),
                    onError: () => toast.error("Failed to delete view"),
                  });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Save button -- exposed for placement in the filters bar */}
      {/* This is returned as part of the component but the save icon button
          needs to be placed by the parent page in the filters area.
          Instead, expose the save dialog trigger function. */}

      {/* Save View Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              placeholder="View name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createView.isPending}>
                {createView.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Design decision:** The save trigger button needs to be in the filters bar, not in the saved views bar. Two options:
1. Use `React.forwardRef` + `useImperativeHandle` to expose `openSaveDialog()` -- over-engineered.
2. Accept a render prop or keep the Save button inside the bar but visually separate.
3. **Chosen: Keep the save button as part of the component, positioned after the views chips.** The parent page adds a `<SavedViewsBar>` between the header and filters, and also adds the Save icon button in the filters bar that triggers `setSaveOpen` via a passed-down ref.

**Revised approach:** Since each page needs the save button placed in a different location (inside the filters row), use a simpler pattern. Instead of a full reusable component, **extract the save dialog and views bar as separate pieces, and use the existing hooks directly in each page**. This matches the pattern already established on the contacts page and avoids over-abstraction.

**Revised plan:** Do NOT create a reusable component. Instead, replicate the contacts page pattern (which is ~30 lines of code) to each page. The save dialog, views bar, and handlers are simple enough to inline. Extracting would save minimal lines but add indirection. Each page has different filter shapes, so the save/load logic is page-specific anyway.

### Step 2 (revised): Add saved views to deals page
**File:** `src/app/(dashboard)/deals/page.tsx` (edit)

The deals page currently has no filters. To make saved views useful, first add basic filters, then wire up saved views.

**New state variables:**
```ts
const [search, setSearch] = useState("");
const [priorityFilter, setPriorityFilter] = useState<string>("all");
const [saveViewOpen, setSaveViewOpen] = useState(false);
const [viewName, setViewName] = useState("");
```

**Hooks:**
```ts
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";

const { data: savedViews } = useSavedViews("deal");
const createView = useCreateSavedView();
const deleteView = useDeleteSavedView();
```

**Note on deals data:** The current `useDeals()` hook fetches all deals without filtering. We need to check whether it accepts filter params.

Check `src/lib/hooks/use-deals.ts` and `src/lib/api/deals.ts` to understand the current deal listing API. If it does not support search/filter params, the saved views can still store the filter intent and apply client-side filtering. However, for consistency, we should add filter params if missing.

**If `useDeals()` does NOT accept filters:** Add search and priority as query params to the deals list API. This is a prerequisite change:
- Update `src/lib/api/deals.ts` `listDeals()` to accept `search?: string` and `priority?: string` params
- Update `src/app/api/deals/route.ts` GET handler to pass these through
- Update `src/lib/hooks/use-deals.ts` `useDeals()` to accept and pass filter params

**If `useDeals()` already accepts filters:** Use them directly.

**Implementation pattern (same as contacts page):**

1. **Saved Views bar** -- Between header and table:
```tsx
{savedViews && savedViews.length > 0 && (
  <div className="flex items-center gap-2 overflow-x-auto">
    <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
    {savedViews.map((view: { id: string; name: string; filters: Record<string, unknown>[] }) => (
      <div key={view.id} className="flex items-center gap-0.5">
        <Button variant="outline" size="sm" className="text-xs h-7 rounded-r-none"
          onClick={() => handleLoadView(view)}>
          {view.name}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7 px-1.5 rounded-l-none border-l-0"
          onClick={() => deleteView.mutate(view.id, {
            onSuccess: () => toast.success("View deleted"),
          })}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    ))}
  </div>
)}
```

2. **Filters bar** -- Add between header and table (before the table div):
```tsx
<div className="flex flex-wrap items-center gap-3">
  <div className="relative flex-1 min-w-[200px] max-w-sm">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Search deals..." value={search}
      onChange={(e) => setSearch(e.target.value)} className="pl-9" />
  </div>
  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
    <SelectTrigger className="w-[150px]">
      <SelectValue placeholder="Priority" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Priorities</SelectItem>
      <SelectItem value="low">Low</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="high">High</SelectItem>
      <SelectItem value="urgent">Urgent</SelectItem>
    </SelectContent>
  </Select>
  <Button variant="ghost" size="sm" onClick={() => setSaveViewOpen(true)} title="Save current filters as a view">
    <Save className="h-4 w-4" />
  </Button>
</div>
```

3. **Save/load handlers:**
```ts
function handleSaveView(e: React.FormEvent) {
  e.preventDefault();
  if (!viewName.trim()) return;
  const filters: Record<string, unknown>[] = [];
  if (search) filters.push({ field: "search", value: search });
  if (priorityFilter !== "all") filters.push({ field: "priority", value: priorityFilter });

  createView.mutate(
    { name: viewName.trim(), entityType: "deal", filters },
    {
      onSuccess: () => {
        toast.success("View saved");
        setSaveViewOpen(false);
        setViewName("");
      },
    }
  );
}

function handleLoadView(view: { filters: Record<string, unknown>[] }) {
  setSearch("");
  setPriorityFilter("all");
  for (const f of view.filters) {
    if (f.field === "search") setSearch(f.value as string);
    if (f.field === "priority") setPriorityFilter(f.value as string);
  }
}
```

4. **Save View Dialog** -- Same as contacts page pattern (at the end of the component).

5. **New imports:**
```ts
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Save, Bookmark, X } from "lucide-react";
```

6. **Client-side filtering (if API does not support it):** Apply `search` and `priorityFilter` as client-side filters on the `deals` array:
```ts
const filteredDeals = deals?.filter((deal) => {
  if (search && !deal.title.toLowerCase().includes(search.toLowerCase())) return false;
  if (priorityFilter !== "all" && deal.priority !== priorityFilter) return false;
  return true;
});
```
Then use `filteredDeals` instead of `deals` in the table rendering.

### Step 3: Add saved views to tasks page
**File:** `src/app/(dashboard)/tasks/page.tsx` (edit)

The tasks page already has a status filter. Add saved views bar + save logic.

**New state variables:**
```ts
const [saveViewOpen, setSaveViewOpen] = useState(false);
const [viewName, setViewName] = useState("");
```

**Hooks:**
```ts
const { data: savedViews } = useSavedViews("task");
const createView = useCreateSavedView();
const deleteView = useDeleteSavedView();
```

**Filter shape for tasks:**
- `{ field: "status", value: "pending" | "in_progress" | "completed" | "all" }`

**Save handler:**
```ts
function handleSaveView(e: React.FormEvent) {
  e.preventDefault();
  if (!viewName.trim()) return;
  const filters: Record<string, unknown>[] = [];
  if (statusFilter !== "all") filters.push({ field: "status", value: statusFilter });

  createView.mutate(
    { name: viewName.trim(), entityType: "task", filters },
    {
      onSuccess: () => {
        toast.success("View saved");
        setSaveViewOpen(false);
        setViewName("");
      },
    }
  );
}
```

**Load handler:**
```ts
function handleLoadView(view: { filters: Record<string, unknown>[] }) {
  setStatusFilter("all");
  for (const f of view.filters) {
    if (f.field === "status") setStatusFilter(f.value as string);
  }
}
```

**UI additions:**
1. Saved views bar -- between header and filters bar (same pattern as contacts/deals)
2. Save button (floppy icon) -- add to the end of the existing filters bar, next to the status select
3. Save view dialog -- same pattern as contacts page

**Imports to add:** Same as deals page saved views imports plus `Bookmark`, `Save`, `X`.

### Step 4: Add saved views to companies page
**File:** `src/app/(dashboard)/companies/page.tsx` (edit)

The companies page has search, size filter, and industry filter. Add saved views bar + save logic.

**New state variables:**
```ts
const [saveViewOpen, setSaveViewOpen] = useState(false);
const [viewName, setViewName] = useState("");
```

**Hooks:**
```ts
const { data: savedViews } = useSavedViews("company");
const createView = useCreateSavedView();
const deleteView = useDeleteSavedView();
```

**Filter shape for companies:**
- `{ field: "search", value: string }`
- `{ field: "size", value: string }`
- `{ field: "industry", value: string }`

**Save handler:**
```ts
function handleSaveView(e: React.FormEvent) {
  e.preventDefault();
  if (!viewName.trim()) return;
  const filters: Record<string, unknown>[] = [];
  if (search) filters.push({ field: "search", value: search });
  if (sizeFilter !== "all") filters.push({ field: "size", value: sizeFilter });
  if (industryFilter) filters.push({ field: "industry", value: industryFilter });

  createView.mutate(
    { name: viewName.trim(), entityType: "company", filters },
    {
      onSuccess: () => {
        toast.success("View saved");
        setSaveViewOpen(false);
        setViewName("");
      },
    }
  );
}
```

**Load handler:**
```ts
function handleLoadView(view: { filters: Record<string, unknown>[] }) {
  setPage(1);
  setSearch("");
  setSizeFilter("all");
  setIndustryFilter("");
  for (const f of view.filters) {
    if (f.field === "search") setSearch(f.value as string);
    if (f.field === "size") setSizeFilter(f.value as string);
    if (f.field === "industry") setIndustryFilter(f.value as string);
  }
}
```

**UI additions:**
1. Saved views bar -- between header and filters bar
2. Save button -- add to the end of the existing filters bar
3. Save view dialog -- same pattern

**Imports to add:** `useSavedViews`, `useCreateSavedView`, `useDeleteSavedView` from hooks, `Dialog/DialogContent/DialogHeader/DialogTitle/DialogFooter`, `Bookmark`, `Save`, `X` from lucide.

### Step 5: Refactor contacts page to use delete button pattern
**File:** `src/app/(dashboard)/contacts/page.tsx` (edit)

Update the contacts page saved views bar to include the delete button (Step 1 pattern). The contacts page already imports `useDeleteSavedView` but doesn't use it in the views bar.

Replace the existing simple view buttons with the compound button pattern (view name + X delete).

Also add `X` to the lucide imports.

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| VIEW-01 | Saved views work on deals list page | Step 2 (saved views bar, save/load, filters) |
| VIEW-02 | Saved views work on tasks list page | Step 3 (saved views bar, save/load, status filter) |
| VIEW-03 | Saved views work on companies list page | Step 4 (saved views bar, save/load, search/size/industry filters) |
| VIEW-04 | Saved views store entity type, filters, sort, and column visibility | Already supported by schema (entityType, filters, sortBy, columns fields). Steps 2-4 store entityType + filters. Sort and columns can be added later as the pages gain sort/column controls -- the backend already supports them. |
| VIEW-05 | Saved view delete button exists in the saved views bar | Steps 1, 5 (contacts), Steps 2-4 (deals/tasks/companies) -- X button on each view chip |

---

## Risks & Decisions

### No reusable component extraction
**Decision: Inline the pattern on each page rather than abstracting a `<SavedViewsBar>` component.** Each page has different filter shapes (contacts: type + status + search; deals: priority + search; tasks: status; companies: size + industry + search). The save/load logic is filter-shape-specific. A reusable component would either need a complex generic filter interface or render props, adding more code than it saves. The duplicated code is ~30 lines per page and is straightforward to maintain.

### Deals page filters as a prerequisite
The deals page currently has no filters at all. Without filters, saved views on deals would be meaningless (nothing to save). Step 2 adds basic search and priority filters to the deals page. If the `useDeals()` hook does not support filter params, client-side filtering is used as a pragmatic solution. Server-side filtering can be added later as a performance optimization once deal volume grows.

### VIEW-04: Sort and column visibility
The saved views schema already has `sortBy` and `columns` fields. The current implementation across all pages does not have user-configurable sort or column visibility controls. VIEW-04 is satisfied at the data layer -- the views CAN store sort/columns. The UI for configuring sort and column visibility is a future enhancement (not blocked by this phase). The save handler passes only `filters` for now; when sort/column UI is added, the save handler can be extended to include them.

### Delete confirmation
**Decision: No confirmation dialog for view deletion.** Deleting a saved view is low-risk (it's just a filter preset, no data is lost). A toast with "View deleted" is sufficient. If the user deletes accidentally, they can recreate it. This matches the lightweight nature of saved views.

### Save button placement
**Decision: Save button in the filters bar (as a ghost icon button), not in the saved views bar.** The save action relates to the current filter state, so it belongs visually near the filters. This matches the contacts page pattern.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. **Contacts page:**
   - Saved views bar shows view buttons with X delete icons
   - Click X on a view -- view is deleted, toast confirms, bar updates
   - Save button still works to create new views
3. **Deals page:**
   - Search and priority filter controls appear
   - Filtering by search text works (matches deal title)
   - Filtering by priority works
   - Save button appears in filters bar
   - Click Save -- dialog opens, enter name, click Save -- view created, appears in bar
   - Click a saved view -- filters load, table filters accordingly
   - Click X on a view -- view deleted
4. **Tasks page:**
   - Save button appears next to status filter
   - Set status to "in_progress", save view as "Active Work"
   - Reset to "all", click "Active Work" -- status filter changes to "in_progress"
   - X delete works
5. **Companies page:**
   - Save button appears in filters bar
   - Set size filter and search, save as "Large Companies"
   - Reset filters, click "Large Companies" -- filters restore
   - X delete works
6. Views persist across page navigations (stored in DB, not just local state)
7. No console errors throughout all interactions
