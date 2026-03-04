# Phase 8a: Pipeline + Stage CRUD Backend — SUMMARY

**Status:** Complete
**Date:** 2026-03-05

---

## What Was Built

### 1. Zod Validators (`src/lib/validators/pipeline.ts`)
- `createPipelineSchema` — name (required), description, type (enum)
- `updatePipelineSchema` — all fields optional for partial update
- `createStageSchema` — name (required), color (hex), probability (0-100), isWon, isLost, position (optional, auto-increments). Refine: cannot be both won and lost.
- `updateStageSchema` — all fields optional, no position (managed via reorder only)
- `reorderStagesSchema` — array of stage UUIDs in new order

### 2. DAL Functions (`src/lib/api/pipelines.ts`)
Extended with 9 new functions (existing 4 unchanged):
- `createPipeline(data)` — inserts with `isDefault: false`
- `updatePipeline(id, data)` — partial update, returns null if not found
- `deletePipeline(id)` — pre-checks deal count, throws if deals exist, stages cascade-delete
- `countDealsByPipeline(pipelineId)` — count deals referencing pipeline
- `createStage(pipelineId, data)` — auto-increments position if omitted (`max(position) + 1`)
- `updateStage(stageId, data)` — partial update
- `deleteStage(stageId)` — pre-checks deal count, throws if deals exist, re-compacts positions
- `countDealsByStage(stageId)` — count deals referencing stage
- `reorderStages(pipelineId, stageIds)` — validates exact ID match, transactional position update

### 3. API Routes
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/pipeline` | Create pipeline (201) |
| PATCH | `/api/pipeline/[id]` | Update pipeline |
| DELETE | `/api/pipeline/[id]` | Delete pipeline (409 if deals exist) |
| POST | `/api/pipeline/[id]/stages` | Create stage (201, auto-position) |
| PATCH | `/api/pipeline/[id]/stages/[stageId]` | Update stage |
| DELETE | `/api/pipeline/[id]/stages/[stageId]` | Delete stage (409 if deals exist) |
| PUT | `/api/pipeline/[id]/stages/reorder` | Reorder stages (transactional) |

### 4. React Query Hooks (`src/lib/hooks/use-pipeline.ts`)
7 new mutation hooks (existing 3 unchanged):
- `useCreatePipeline()` — invalidates `["pipelines"]`
- `useUpdatePipeline()` — invalidates `["pipelines"]`, `["pipeline"]`
- `useDeletePipeline()` — invalidates `["pipelines"]`
- `useCreateStage()` — invalidates `["pipelines"]`, `["pipeline"]`
- `useUpdateStage()` — invalidates `["pipelines"]`, `["pipeline"]`
- `useDeleteStage()` — invalidates `["pipelines"]`, `["pipeline"]`
- `useReorderStages()` — invalidates `["pipelines"]`, `["pipeline"]`

---

## Key Design Decisions
- **Delete protection:** Both pipeline and stage delete pre-check for existing deals. Returns 409 (Conflict) with descriptive message, never hitting FK constraint errors.
- **Position management:** Stage position is excluded from update schema. Position changes only through reorder endpoint. Create auto-increments. Delete re-compacts.
- **Reorder atomicity:** Uses Drizzle transaction. Input must contain exact same set of stage IDs as pipeline (no missing, no extras), else 400.
- **No cascade on pipeline/stage delete for deals:** FK constraints on `deals.pipelineId` and `deals.stageId` have no cascade — intentional to prevent data loss.

---

## Files Changed
- `src/lib/validators/pipeline.ts` (new)
- `src/lib/api/pipelines.ts` (extended)
- `src/app/api/pipeline/route.ts` (extended with POST)
- `src/app/api/pipeline/[id]/route.ts` (extended with PATCH, DELETE)
- `src/app/api/pipeline/[id]/stages/route.ts` (new)
- `src/app/api/pipeline/[id]/stages/[stageId]/route.ts` (new)
- `src/app/api/pipeline/[id]/stages/reorder/route.ts` (new)
- `src/lib/hooks/use-pipeline.ts` (extended)

## Verification
- TypeScript: `npx tsc --noEmit` passes with no errors
- Build: `npm run build` passes successfully
- Existing pipelines query hook and Kanban board unaffected
