# 08b Pipeline Management UI - Summary

**Status:** Complete
**Completed:** 2026-03-05

## What was built

Replaced the read-only `PipelinesSettings` component in the Settings page with a fully interactive pipeline management UI supporting CRUD operations and drag-to-reorder stages.

## Components Created

### `src/components/settings/sortable-stage-row.tsx`
Draggable stage row using `@dnd-kit/sortable`. Displays grip handle, color dot, stage name, probability percentage, isWon/isLost badges, and edit/delete action buttons.

### `src/components/settings/pipeline-dialog.tsx`
Create/edit pipeline dialog with name (required), description (optional textarea), and type (select from pipelineTypeEnum values). Resets form state on open. Uses `useCreatePipeline` / `useUpdatePipeline` hooks.

### `src/components/settings/stage-dialog.tsx`
Create/edit stage dialog with name, color picker (preset color grid + hex input), probability (0-100), and isWon/isLost checkboxes with auto-toggle behavior (checking Won unchecks Lost and sets probability to 100, and vice versa). Uses `useCreateStage` / `useUpdateStage` hooks.

### `src/components/settings/pipeline-card.tsx`
Card-per-pipeline layout with:
- Header: pipeline name, type badge, default badge, edit/delete buttons
- Delete disabled for default pipeline
- Stages section: vertical sortable list using `DndContext` + `SortableContext` + `restrictToVerticalAxis` modifier
- "Add Stage" button opens StageDialog in create mode
- AlertDialog confirmations for both pipeline and stage deletes
- 409 error handling shows descriptive toast ("Cannot delete with existing deals")

### `src/app/(dashboard)/settings/page.tsx` (modified)
Replaced PipelinesSettings function. Now renders pipeline cards with "Add Pipeline" button at top. Loading state shows skeleton placeholders. Empty state shows prompt to create first pipeline.

## Dependencies Added
- `@dnd-kit/modifiers` - for `restrictToVerticalAxis` stage drag constraint

## Requirements Covered
| Req | Description | Implementation |
|-----|-------------|----------------|
| PIPE-01 | Create pipeline | PipelineDialog create mode + "Add Pipeline" button |
| PIPE-02 | Edit pipeline | PipelineDialog edit mode + edit button in PipelineCard |
| PIPE-03 | Delete pipeline (409 if deals) | AlertDialog + error toast |
| PIPE-04 | Create stage | StageDialog create mode + "Add Stage" button |
| PIPE-05 | Edit stage | StageDialog edit mode + edit button in stage row |
| PIPE-06 | Delete stage (409 if deals) | AlertDialog + error toast |
| PIPE-07 | Drag-to-reorder stages | DndContext + SortableContext + useReorderStages |
| PIPE-08 | Replace read-only tab | PipelinesSettings rewritten |
