# Phase 8b: Pipeline Management UI

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08
**Scope:** Replace the read-only `PipelinesSettings` component in the Settings page with an interactive pipeline management UI: create/edit/delete pipelines, create/edit/delete stages, drag-to-reorder stages.
**Wave:** 2 (depends on Wave 1 — 08a backend)
**Depends on:** 08a (all API routes and hooks must be available)

---

## Current State Assessment

### What exists after Wave 1:
- Full CRUD API for pipelines: `POST/PATCH/DELETE /api/pipeline[/id]`
- Full CRUD API for stages: `POST /api/pipeline/:id/stages`, `PATCH/DELETE /api/pipeline/:id/stages/:stageId`
- Reorder API: `PUT /api/pipeline/:id/stages/reorder`
- React Query hooks: `useCreatePipeline`, `useUpdatePipeline`, `useDeletePipeline`, `useCreateStage`, `useUpdateStage`, `useDeleteStage`, `useReorderStages`
- Existing `usePipelines()` returns all pipelines with stages

### What exists now (to be replaced):
- **`PipelinesSettings`** component in `src/app/(dashboard)/settings/page.tsx` (lines 575-657) — read-only card showing pipeline names, types, and stages as a horizontal flow with arrows. No interactivity beyond viewing.

### @dnd-kit patterns already in codebase:
- `src/components/pipeline/kanban-board.tsx` — Uses `DndContext`, `PointerSensor`, `useSensor/useSensors`, `closestCorners` collision detection.
- `src/components/pipeline/kanban-column.tsx` — Uses `useDroppable`, `SortableContext`, `verticalListSortingStrategy`.
- `src/components/pipeline/deal-card.tsx` — Uses `useSortable` for draggable items.
- These components are for dragging deals between columns (horizontal). For stage reorder, we need vertical drag-to-reorder within a single list — slightly different but same library.

### UI components available (shadcn/ui):
- Dialog, Input, Select, Button, Badge, Card, Table, Skeleton — all already imported in settings page
- `AlertDialog` — needed for delete confirmations. Check if already installed, if not run `npx shadcn@latest add alert-dialog`.
- `Label` — from shadcn/ui, for form labels

---

## Implementation Steps

### Step 1: Check/add AlertDialog component
**Action:** Check if `src/components/ui/alert-dialog.tsx` exists. If not, add it via shadcn CLI.

This is needed for delete confirmations on pipelines and stages ("Are you sure? This cannot be undone.").

### Step 2: Create the PipelineCard component
**File:** `src/components/settings/pipeline-card.tsx` (new)

This component renders a single pipeline's card with its stages, and provides all CRUD operations.

**Props:**
```ts
interface PipelineCardProps {
  pipeline: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    isDefault: boolean;
    stages: Array<{
      id: string;
      name: string;
      position: number;
      color: string | null;
      probability: number | null;
      isWon: boolean;
      isLost: boolean;
    }>;
  };
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Pipeline Name          [enterprise]    [Edit] [Delete]  │
│ Description text here                                    │
│                                                          │
│ Stages                                    [+ Add Stage]  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ≡  ● Lead           10%              [Edit] [Del]  │   │
│ │ ≡  ● Qualified       25%              [Edit] [Del]  │   │
│ │ ≡  ● Demo            50%              [Edit] [Del]  │   │
│ │ ≡  ● Proposal        75%              [Edit] [Del]  │   │
│ │ ≡  ● Closed Won     100%  ✓ Won      [Edit] [Del]  │   │
│ │ ≡  ● Closed Lost      0%  ✗ Lost     [Edit] [Del]  │   │
│ └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Pipeline header:**
- Pipeline name as `<h3>` with type badge
- Description as muted text below (if present)
- Edit button (pencil icon) — opens EditPipelineDialog
- Delete button (trash icon) — opens AlertDialog confirmation. Disabled if pipeline.isDefault. On confirm, calls `useDeletePipeline().mutate(id)`. On error (409), toast "Cannot delete pipeline with existing deals — move or delete deals first."

**Stages section:**
- "Stages" subheading with "Add Stage" button
- Stages rendered as a vertical sortable list using @dnd-kit
- Each stage row shows: drag handle (GripVertical icon), color dot, name, probability %, isWon/isLost badge, edit button, delete button

**Stage DnD:**
- Wrap stage list in `DndContext` + `SortableContext` with `verticalListSortingStrategy`
- Each stage row uses `useSortable` (from `@dnd-kit/sortable`)
- On drag end: compute new order of stage IDs, call `useReorderStages().mutate({ pipelineId, stageIds })`
- Use `restrictToVerticalAxis` modifier from `@dnd-kit/modifiers` to prevent horizontal drag

**Stage row component (inline or extracted):**
- Uses `useSortable` hook for drag handle
- Renders: `<GripVertical>` as drag handle (via `attributes` + `listeners` from useSortable), color dot, name text, probability badge, isWon/isLost indicator, edit/delete buttons
- Edit button opens StageEditDialog
- Delete button opens AlertDialog. On error (409), toast "Cannot delete stage with existing deals."

### Step 3: Create/Edit Pipeline Dialog
**File:** `src/components/settings/pipeline-dialog.tsx` (new)

A single dialog component used for both creating and editing pipelines.

**Props:**
```ts
interface PipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: {
    id: string;
    name: string;
    description: string | null;
    type: string;
  } | null;
  // If pipeline is provided, it's an edit. If null/undefined, it's a create.
}
```

**Form fields:**
- Name — Input (required)
- Description — Textarea (optional)
- Type — Select with options: Seller Onboarding, Enterprise, Partnerships, Custom

**State:**
- `name`, `description`, `type` — initialized from `pipeline` prop if editing, empty if creating
- `useEffect` resets form when `pipeline` or `open` changes (same pattern as `edit-contact-dialog.tsx`)

**On submit:**
- If editing: `useUpdatePipeline().mutate({ id: pipeline.id, data: { name, description, type } })`
- If creating: `useCreatePipeline().mutate({ name, description, type })`
- Toast success, close dialog

### Step 4: Stage Create/Edit Dialog
**File:** `src/components/settings/stage-dialog.tsx` (new)

**Props:**
```ts
interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stage?: {
    id: string;
    name: string;
    color: string | null;
    probability: number | null;
    isWon: boolean;
    isLost: boolean;
  } | null;
  // If stage provided, it's an edit. If null/undefined, it's a create.
}
```

**Form fields:**
- Name — Input (required)
- Color — Color picker: grid of preset colors (same `TAG_COLORS` array used in tags settings) + a text input for custom hex. Show a preview dot next to the input.
- Probability — Number input (0-100, with % suffix label)
- Is Won — Checkbox. When checked, auto-uncheck "Is Lost" and set probability to 100.
- Is Lost — Checkbox. When checked, auto-uncheck "Is Won" and set probability to 0.

**State:** Same pattern as pipeline dialog — reset on open/stage change.

**On submit:**
- If editing: `useUpdateStage().mutate({ pipelineId, stageId: stage.id, data: { name, color, probability, isWon, isLost } })`
- If creating: `useCreateStage().mutate({ pipelineId, data: { name, color, probability, isWon, isLost } })` (position omitted — backend auto-appends)
- Toast success, close dialog

### Step 5: Sortable Stage Row component
**File:** `src/components/settings/sortable-stage-row.tsx` (new)

Extracted as a separate component because `useSortable` requires its own component boundary.

**Props:**
```ts
interface SortableStageRowProps {
  stage: {
    id: string;
    name: string;
    color: string | null;
    probability: number | null;
    isWon: boolean;
    isLost: boolean;
  };
  pipelineId: string;
  onEdit: (stage: SortableStageRowProps["stage"]) => void;
  onDelete: (stageId: string) => void;
}
```

**Implementation:**
```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

export function SortableStageRow({ stage, onEdit, onDelete }: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.color ?? "#6B7280" }} />
      <span className="text-sm font-medium flex-1">{stage.name}</span>
      {stage.probability != null && (
        <span className="text-xs text-muted-foreground">{stage.probability}%</span>
      )}
      {stage.isWon && <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-xs">Won</Badge>}
      {stage.isLost && <Badge variant="destructive" className="text-xs">Lost</Badge>}
      <button onClick={() => onEdit(stage)} className="text-muted-foreground hover:text-foreground">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => onDelete(stage.id)} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

**DnD integration notes:**
- The parent `PipelineCard` wraps stages in `<DndContext>` + `<SortableContext items={sortedStages.map(s => s.id)} strategy={verticalListSortingStrategy}>`.
- Import `restrictToVerticalAxis` from `@dnd-kit/modifiers` and pass to `DndContext` via `modifiers={[restrictToVerticalAxis]}`.
- The `@dnd-kit/modifiers` package may not be installed. Check `package.json`. If missing: `npm install @dnd-kit/modifiers`.

### Step 6: Replace PipelinesSettings component
**File:** `src/app/(dashboard)/settings/page.tsx` (edit)

Replace the existing `PipelinesSettings` function (lines 575-657) with the new interactive version.

**New `PipelinesSettings` component:**
```tsx
function PipelinesSettings() {
  const { data: pipelines, isLoading } = usePipelines();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipelines</h2>
          <p className="text-sm text-muted-foreground">
            Manage pipelines and their stages. Drag to reorder stages.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pipeline
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No pipelines configured. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        pipelines.map((pipeline) => (
          <PipelineCard key={pipeline.id} pipeline={pipeline} />
        ))
      )}

      <PipelineDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

**Imports to add to settings page:**
- `PipelineCard` from `@/components/settings/pipeline-card`
- `PipelineDialog` from `@/components/settings/pipeline-dialog`

**Imports to remove (no longer needed in this component):**
- The `usePipelines` import stays (still used)
- The inline pipeline type annotations are replaced by the `PipelineCard` component

**Note:** The `PipelinesSettings` is no longer wrapped in a `<Card>` — each pipeline gets its own card via `PipelineCard`. The outer wrapper is a plain `<div className="space-y-4">`.

The `<TabsContent value="pipelines">` in the parent page still wraps this, so the tab switching behavior is unchanged.

### Step 7: Install @dnd-kit/modifiers (if needed)
**Action:** Check if `@dnd-kit/modifiers` is in `package.json`. If not:
```bash
npm install @dnd-kit/modifiers
```

This package provides `restrictToVerticalAxis` which constrains drag movement to the Y axis — essential for stage reordering UX.

### Step 8: Install @dnd-kit/sortable (verify)
**Action:** Verify `@dnd-kit/sortable` and `@dnd-kit/utilities` are in `package.json`. They should be (used by Kanban), but confirm.

These are needed for `useSortable`, `SortableContext`, `verticalListSortingStrategy`, and `CSS.Transform`.

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| PIPE-01 | Create pipeline with name, description, type | Step 3 (PipelineDialog create mode) + Step 6 ("Add Pipeline" button) |
| PIPE-02 | Edit pipeline name, description, type | Step 3 (PipelineDialog edit mode) + Step 2 (edit button in PipelineCard header) |
| PIPE-03 | Delete pipeline (only if no deals) | Step 2 (delete button + AlertDialog, 409 error toast) |
| PIPE-04 | Create stage with name, color, probability, isWon, isLost, position | Step 4 (StageDialog create mode) + Step 2 ("Add Stage" button) |
| PIPE-05 | Edit stage properties | Step 4 (StageDialog edit mode) + Step 5 (edit button in stage row) |
| PIPE-06 | Delete stage (only if no deals) | Step 5 (delete button in stage row) + Step 2 (AlertDialog, 409 error toast) |
| PIPE-07 | Drag-to-reorder stages | Steps 2, 5 (DndContext + SortableContext + useSortable + reorder hook) |
| PIPE-08 | Pipeline management UI replaces read-only tab | Step 6 (replace PipelinesSettings component) |

---

## Risks & Decisions

### DnD within settings vs. Kanban DnD
The Kanban board uses @dnd-kit for dragging deals between columns (horizontal). The settings page uses it for vertical reordering of stages within a pipeline. These are independent `DndContext` instances — no interference. However, if both are on screen simultaneously (they won't be — settings and pipeline are different pages), there would be no conflict because each `DndContext` manages its own scope.

### @dnd-kit/modifiers dependency
The `restrictToVerticalAxis` modifier from `@dnd-kit/modifiers` is a quality-of-life improvement. If for some reason the package can't be installed, the reorder still works without it — stages would just be draggable in all directions visually (but would snap to the correct vertical position on drop). It's a nice-to-have, not a blocker.

### Optimistic updates for reorder
For the best UX, the stage list should reorder optimistically (update the UI immediately, revert on error). Implementation approach:
- On drag end, compute new `stageIds` order.
- Optimistically update the local pipelines query data via `queryClient.setQueryData`.
- Call `useReorderStages().mutate()`.
- On error, invalidate queries (triggering a refetch that reverts to server state) and toast the error.

This prevents the jarring "snap back then re-snap forward" when the server responds. The `onMutate` / `onError` / `onSettled` pattern from React Query handles this.

### Delete confirmation UX
Both pipeline and stage deletes use `AlertDialog` for confirmation. The 409 error case (deals exist) shows a descriptive toast rather than a pre-check. Reason: pre-checking adds latency and the condition is rare. The toast message tells the user exactly what to do: "Cannot delete — move or delete existing deals first."

### Card-per-pipeline vs. single card
Each pipeline gets its own `<Card>` (via `PipelineCard`) rather than all pipelines in a single card. This matches how other CRMs present pipeline settings and makes the drag-to-reorder scope visually clear. The old read-only view used a single card, but the interactive version benefits from separation.

### Color picker simplicity
The stage color picker uses the same preset color grid as the Tags settings (`TAG_COLORS` array). This keeps the UI consistent across settings tabs. A custom hex input is also provided for flexibility. No external color picker library is needed.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Settings > Pipelines tab
3. Existing pipelines display as interactive cards with stages
4. Click "Add Pipeline" — dialog opens, fill in name + type, create succeeds
5. Click pipeline edit button — dialog opens pre-filled, changes save
6. Click pipeline delete button — confirmation dialog. If no deals, deletes. If deals exist, toast shows error.
7. Click "Add Stage" on a pipeline — dialog opens, fill in name + color + probability, create succeeds. New stage appears at bottom of list.
8. Click stage edit button — dialog opens pre-filled, changes save
9. Click stage delete button — confirmation. If no deals, deletes. If deals exist, toast shows error.
10. Drag a stage handle up/down — stage list reorders smoothly. Release — order persists (server updated).
11. Refresh page — reordered stages persist in new order.
12. Navigate to Pipeline page — Kanban board still works correctly, deals can still be dragged between stages.
13. No console errors throughout all interactions.
