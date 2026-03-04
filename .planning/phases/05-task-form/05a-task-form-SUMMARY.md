# 05a-task-form Summary

## What was built

### Backend
- **`getTask(id)`** function in `src/lib/api/tasks.ts` -- fetches a single task by ID with joined assignee and contact names (same shape as `listTasks` plus `description`, `creatorId`, `completedAt`, `updatedAt`).
- **`GET /api/tasks/[id]`** handler in `src/app/api/tasks/[id]/route.ts` -- returns single task JSON or 404. Completes TASK-05.

### Frontend hooks
- **`useTask(id)`** hook in `src/lib/hooks/use-tasks.ts` -- React Query hook for fetching a single task, with `enabled: !!id` guard.

### TaskFormDialog component
- **`src/components/tasks/task-form-dialog.tsx`** -- unified create/edit dialog.
- **All fields exposed:** title, description, status, priority, dueDate, assigneeId (UserPicker), contactId (ContactPicker), dealId (DealPicker).
- **Create mode:** status field hidden (always "pending"), priority shown full-width.
- **Edit mode:** status Select shown with all four enum values, priority in 2-column grid alongside status.
- **Props:** `task` (edit mode), `defaultContactId`, `defaultDealId` (Phase 6 pre-fill), `open`, `onOpenChange`.
- **useEffect reset** on open: populates from `task` prop in edit mode, resets to defaults in create mode.
- **Error handling:** dialog stays open on error, toast messages for success/failure.

### Tasks page wiring
- **Replaced** inline create dialog (with only title/priority/dueDate) with `TaskFormDialog` in create mode.
- **Added** "Edit" option to row dropdown menu (before "Delete").
- **Fetch-on-click** pattern: clicking Edit fetches full task via `GET /api/tasks/[id]`, then opens `TaskFormDialog` in edit mode.
- **Removed** unused state: `newTitle`, `newPriority`, `newDueDate`, `handleCreate`, `useCreateTask` import from page (now handled inside TaskFormDialog).

## Requirements satisfied
- TASK-01: Create task via TaskFormDialog
- TASK-02: Edit task via TaskFormDialog
- TASK-03: All fields exposed in form
- TASK-04: Pre-fills current values in edit mode
- TASK-05: GET /api/tasks/[id] endpoint

## Files modified
- `src/lib/api/tasks.ts` -- added `getTask(id)`
- `src/app/api/tasks/[id]/route.ts` -- added GET handler
- `src/lib/hooks/use-tasks.ts` -- added `useTask(id)`
- `src/components/tasks/task-form-dialog.tsx` -- new component
- `src/app/(dashboard)/tasks/page.tsx` -- replaced inline dialog, added edit

## Commits
1. `feat(05a-task-form): task 1 - Add getTask(id) to data access layer`
2. `feat(05a-task-form): task 2 - Add GET handler to /api/tasks/[id]`
3. `feat(05a-task-form): task 3 - Add useTask(id) hook`
4. `feat(05a-task-form): task 4 - Create TaskFormDialog component`
5. `feat(05a-task-form): task 5 - Wire TaskFormDialog into tasks list page`
