# Phase 8a: Pipeline + Stage CRUD Backend

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07
**Scope:** Zod validators, full CRUD DAL for pipelines and stages, API routes (POST/PATCH/DELETE for pipelines, POST/PATCH/DELETE for stages, PUT for stage reorder), React Query mutation hooks.
**Wave:** 1 (no UI changes — backend only, consumed by Wave 2)

---

## Current State Assessment

### What already exists and works:
- **Schema** (`src/lib/db/schema.ts`):
  - `pipelines` table: id, name, description, type (pgEnum: seller_onboarding, enterprise, partnerships, custom), isDefault, createdAt.
  - `pipelineStages` table: id, pipelineId (FK cascade), name, position, color, probability, isWon, isLost. Index on pipelineId.
  - Relations: `pipelines.stages` (one-to-many), `pipelineStages.pipeline` (many-to-one), `pipelineStages.deals` (one-to-many).
  - `deals.pipelineId` and `deals.stageId` are FK references (no cascade on pipeline delete, no cascade on stage delete). This is critical: deleting a pipeline or stage that has deals would violate FK constraints.

- **DAL** (`src/lib/api/pipelines.ts`):
  - `listPipelines()` — Returns all pipelines with their stages. Works fine, no changes needed.
  - `getPipelineWithStages(id)` — Returns single pipeline with stages. Works fine.
  - `getDefaultPipeline()` — Returns the default pipeline (or first). Works fine.
  - `seedDefaultPipelines()` — Seeds two default pipelines with stages. Works fine.
  - **No create, update, delete, or stage management functions.**

- **API routes:**
  - `GET /api/pipeline` — Lists all pipelines (calls `listPipelines`). Also auto-seeds on first call.
  - `GET /api/pipeline/[id]` — Gets pipeline with stages and deals.
  - **No POST, PATCH, or DELETE routes for pipelines or stages.**

- **Hooks** (`src/lib/hooks/use-pipeline.ts`):
  - `usePipelines()` — Fetches all pipelines. queryKey: `["pipelines"]`.
  - `usePipelineWithDeals(pipelineId)` — Fetches single pipeline. queryKey: `["pipeline", pipelineId]`.
  - `useMoveDeal()` — Moves deal between stages.
  - **No pipeline or stage mutation hooks.**

- **@dnd-kit** — Already in `package.json` and used in the Kanban board (`src/components/pipeline/kanban-board.tsx`). Uses `DndContext`, `PointerSensor`, `closestCorners`, `useDroppable`, `SortableContext`, `verticalListSortingStrategy`. This establishes the DnD pattern for Wave 2 to follow.

### What needs to be built:
1. **Zod validators** for pipeline create/update and stage create/update
2. **DAL functions** — `createPipeline`, `updatePipeline`, `deletePipeline`, `createStage`, `updateStage`, `deleteStage`, `reorderStages`, `countDealsByPipeline`, `countDealsByStage`
3. **API routes** — `POST /api/pipeline`, `PATCH /api/pipeline/[id]`, `DELETE /api/pipeline/[id]`, `POST /api/pipeline/[id]/stages`, `PATCH /api/pipeline/[id]/stages/[stageId]`, `DELETE /api/pipeline/[id]/stages/[stageId]`, `PUT /api/pipeline/[id]/stages/reorder`
4. **React Query hooks** — `useCreatePipeline`, `useUpdatePipeline`, `useDeletePipeline`, `useCreateStage`, `useUpdateStage`, `useDeleteStage`, `useReorderStages`

---

## Implementation Steps

### Step 1: Zod validators
**File:** `src/lib/validators/pipeline.ts` (new)

```ts
import { z } from "zod";

export const createPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["seller_onboarding", "enterprise", "partnerships", "custom"]),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["seller_onboarding", "enterprise", "partnerships", "custom"]).optional(),
});

export const createStageSchema = z.object({
  name: z.string().min(1, "Stage name is required").max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().nullable(),
  probability: z.number().int().min(0).max(100).optional().nullable(),
  isWon: z.boolean().optional().default(false),
  isLost: z.boolean().optional().default(false),
  position: z.number().int().min(0).optional(),
  // position is optional on create — if omitted, append to end
}).refine(
  (data) => !(data.isWon && data.isLost),
  { message: "A stage cannot be both won and lost" }
);

export const updateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  probability: z.number().int().min(0).max(100).optional().nullable(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
}).refine(
  (data) => !(data.isWon && data.isLost),
  { message: "A stage cannot be both won and lost" }
);

export const reorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1, "At least one stage ID required"),
  // Array of stage IDs in new order. Position is derived from array index.
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;
```

**Notes:**
- `updateStageSchema` does NOT include `position` — position is managed only through the reorder endpoint to prevent inconsistent state.
- The `isWon`/`isLost` refinement prevents a stage from being both.
- `createStageSchema.position` is optional. If omitted, the DAL will set it to `max(position) + 1` for that pipeline.

### Step 2: Extend pipeline DAL
**File:** `src/lib/api/pipelines.ts` (extend, do NOT rewrite — keep existing functions)

Add these functions after the existing ones:

**`createPipeline(data: CreatePipelineInput)`:**
- Insert into `pipelines` with `isDefault: false` (new pipelines are never auto-default).
- Return the created pipeline.

**`updatePipeline(id: string, data: UpdatePipelineInput)`:**
- Update `pipelines` where `id` matches.
- Only set fields present in `data` (spread `data` into update — Drizzle ignores undefined).
- Return the updated pipeline or null if not found.

**`deletePipeline(id: string)`:**
- First check: `countDealsByPipeline(id)`. If > 0, throw an error: `"Cannot delete pipeline with existing deals"`.
- Delete from `pipelines` where `id` matches. Stages cascade-delete via FK.
- Return `{ success: true }`.

**`countDealsByPipeline(pipelineId: string)`:**
- `SELECT count(*) FROM deals WHERE pipeline_id = ?`
- Return number.

**`createStage(pipelineId: string, data: CreateStageInput)`:**
- If `data.position` is undefined, query `SELECT max(position) FROM pipeline_stages WHERE pipeline_id = ?` and set position to `max + 1` (or 0 if no stages exist).
- Insert into `pipelineStages` with `{ ...data, pipelineId }`.
- Return the created stage.

**`updateStage(stageId: string, data: UpdateStageInput)`:**
- Update `pipelineStages` where `id = stageId`.
- Return the updated stage or null if not found.

**`deleteStage(stageId: string)`:**
- First check: `countDealsByStage(stageId)`. If > 0, throw an error: `"Cannot delete stage with existing deals"`.
- Get the stage's pipelineId and position before deleting (needed for re-ordering remaining stages).
- Delete from `pipelineStages` where `id = stageId`.
- Recompact positions: update all stages in the same pipeline where position > deleted position, decrement by 1. Use raw SQL or a loop:
  ```ts
  await db.execute(
    sql`UPDATE pipeline_stages SET position = position - 1 WHERE pipeline_id = ${pipelineId} AND position > ${deletedPosition}`
  );
  ```
- Return `{ success: true }`.

**`countDealsByStage(stageId: string)`:**
- `SELECT count(*) FROM deals WHERE stage_id = ?`
- Return number.

**`reorderStages(pipelineId: string, stageIds: string[])`:**
- Validate: fetch all stages for this pipeline. Verify the incoming `stageIds` contains exactly the same set of IDs (no missing, no extras). Throw if mismatch.
- Use a transaction to update all positions atomically:
  ```ts
  await db.transaction(async (tx) => {
    for (let i = 0; i < stageIds.length; i++) {
      await tx
        .update(pipelineStages)
        .set({ position: i })
        .where(eq(pipelineStages.id, stageIds[i]));
    }
  });
  ```
- Return the updated stages list (re-fetch with `getPipelineWithStages`).

**Imports needed:** Add `sql` from `drizzle-orm`, `count` from `drizzle-orm`, and `deals` from schema.

### Step 3: API route — pipeline collection (POST)
**File:** `src/app/api/pipeline/route.ts` (extend existing)

Add `POST` handler alongside the existing `GET`:

```ts
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();
    const parsed = createPipelineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const pipeline = await createPipeline(parsed.data);
    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/pipeline error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Add `NextRequest` to the import (if not already there). Import `createPipelineSchema` from validators and `createPipeline` from DAL.

### Step 4: API route — individual pipeline (PATCH, DELETE)
**File:** `src/app/api/pipeline/[id]/route.ts` (extend existing)

Add `PATCH` and `DELETE` handlers alongside the existing `GET`:

**PATCH handler:**
- Parse body with `updatePipelineSchema.safeParse(body)`.
- Call `updatePipeline(id, parsed.data)`.
- Return 404 if null, else return updated pipeline.

**DELETE handler:**
- Call `deletePipeline(id)`.
- If it throws "Cannot delete pipeline with existing deals", return 409 (Conflict) with the error message.
- Return `{ success: true }` on success.

Error handling pattern: same try/catch as existing GET, with an additional catch for the "cannot delete" business logic error.

```ts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    await deletePipeline(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("DELETE /api/pipeline/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 5: API route — stages collection
**File:** `src/app/api/pipeline/[id]/stages/route.ts` (new)

**POST handler:**
- Extract `pipelineId` from `params.id`.
- Validate the pipeline exists (call `getPipelineWithStages(id)`, 404 if null).
- Parse body with `createStageSchema.safeParse(body)`.
- Call `createStage(pipelineId, parsed.data)`.
- Return 201 with created stage.

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { getPipelineWithStages, createStage } from "@/lib/api/pipelines";
import { createStageSchema } from "@/lib/validators/pipeline";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const pipeline = await getPipelineWithStages(id);
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createStageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const stage = await createStage(id, parsed.data);
    return NextResponse.json(stage, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/pipeline/[id]/stages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 6: API route — individual stage (PATCH, DELETE)
**File:** `src/app/api/pipeline/[id]/stages/[stageId]/route.ts` (new)

**PATCH handler:**
- Parse body with `updateStageSchema.safeParse(body)`.
- Call `updateStage(stageId, parsed.data)`.
- Return 404 if null.

**DELETE handler:**
- Call `deleteStage(stageId)`.
- Catch "Cannot delete stage with existing deals" and return 409.

Params signature: `{ params: Promise<{ id: string; stageId: string }> }`.

### Step 7: API route — stage reorder
**File:** `src/app/api/pipeline/[id]/stages/reorder/route.ts` (new)

**PUT handler:**
- Parse body with `reorderStagesSchema.safeParse(body)`.
- Call `reorderStages(pipelineId, parsed.data.stageIds)`.
- Return the pipeline with updated stages.

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { reorderStages } from "@/lib/api/pipelines";
import { reorderStagesSchema } from "@/lib/validators/pipeline";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = reorderStagesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await reorderStages(id, parsed.data.stageIds);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("mismatch")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /api/pipeline/[id]/stages/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 8: React Query hooks
**File:** `src/lib/hooks/use-pipeline.ts` (extend existing)

Add these mutation hooks after the existing ones. Follow the same patterns used in the file:

**`useCreatePipeline()`:**
```ts
export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; type: string }) => {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
```

**`useUpdatePipeline()`:**
```ts
export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

**`useDeletePipeline()`:**
```ts
export function useDeletePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete pipeline");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
```

**`useCreateStage()`:**
```ts
export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, data }: { pipelineId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

**`useUpdateStage()`:**
```ts
export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageId, data }: { pipelineId: string; stageId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

**`useDeleteStage()`:**
```ts
export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageId }: { pipelineId: string; stageId: string }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/${stageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

**`useReorderStages()`:**
```ts
export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stageIds }: { pipelineId: string; stageIds: string[] }) => {
      const res = await fetch(`/api/pipeline/${pipelineId}/stages/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reorder stages");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| PIPE-01 | Create pipeline with name, description, type | Steps 1, 2, 3, 8 — Validator, DAL, POST route, hook |
| PIPE-02 | Edit pipeline name, description, type | Steps 1, 2, 4, 8 — Validator, DAL, PATCH route, hook |
| PIPE-03 | Delete pipeline (only if no deals) | Steps 2, 4, 8 — DAL with deal count check, DELETE route, hook |
| PIPE-04 | Create stage with name, color, probability, isWon, isLost, position | Steps 1, 2, 5, 8 — Validator, DAL, POST route, hook |
| PIPE-05 | Edit stage properties | Steps 1, 2, 6, 8 — Validator, DAL, PATCH route, hook |
| PIPE-06 | Delete stage (only if no deals) | Steps 2, 6, 8 — DAL with deal count check, DELETE route, hook |
| PIPE-07 | Drag-to-reorder stages | Steps 1, 2, 7, 8 — Validator, DAL reorder, PUT route, hook (UI in Wave 2) |

---

## Risks & Decisions

### FK constraints block delete
`deals.pipelineId` references `pipelines.id` without `onDelete` cascade. `deals.stageId` references `pipelineStages.id` without cascade. This means Postgres will throw a FK violation error if you try to delete a pipeline/stage that has deals. The DAL pre-checks with `countDealsByPipeline`/`countDealsByStage` and throws a descriptive error before hitting the FK constraint. The API returns 409 (Conflict) so the UI can show a helpful message.

### `pipelineStages` cascade from `pipelines`
The `pipelineStages.pipelineId` FK has `onDelete: "cascade"`. When a pipeline is deleted, its stages auto-delete. This is correct behavior — if no deals reference the pipeline, there are no deals referencing its stages either.

### Reorder atomicity
Stage reorder uses a Drizzle transaction to update all positions atomically. The input must contain exactly the same set of stage IDs that exist for the pipeline. Any mismatch (missing or extra IDs) returns a 400 error.

### No position in updateStage
Position is deliberately excluded from the stage update schema. Position changes must go through the reorder endpoint to maintain consistency. The UI in Wave 2 uses DnD to reorder, which calls the reorder endpoint with the full new order.

### Stage delete re-compacts positions
When a stage is deleted, remaining stages in the same pipeline have their positions re-compacted (stage at position 3 deleted means positions 4, 5, 6 become 3, 4, 5). This keeps positions contiguous for the DnD reorder.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. `POST /api/pipeline` with `{ name: "Test", type: "custom" }` returns 201
3. `PATCH /api/pipeline/:id` with `{ name: "Updated" }` returns updated pipeline
4. `DELETE /api/pipeline/:id` on pipeline with no deals returns success
5. `DELETE /api/pipeline/:id` on pipeline with deals returns 409
6. `POST /api/pipeline/:id/stages` with `{ name: "New Stage", color: "#FF0000" }` returns 201 with auto-position
7. `PATCH /api/pipeline/:id/stages/:stageId` with `{ name: "Renamed" }` returns updated stage
8. `DELETE /api/pipeline/:id/stages/:stageId` on stage with no deals returns success
9. `DELETE /api/pipeline/:id/stages/:stageId` on stage with deals returns 409
10. `PUT /api/pipeline/:id/stages/reorder` with `{ stageIds: [...] }` returns reordered pipeline
11. Existing `usePipelines()` hook still works (settings tab still renders pipelines)
12. Existing Kanban board still works (deal drag-and-drop unaffected)
