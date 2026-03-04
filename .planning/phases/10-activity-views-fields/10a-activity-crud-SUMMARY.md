# 10a-activity-crud — SUMMARY

**Status:** Complete
**Date:** 2026-03-05

## What Was Built

Full edit and delete capabilities for activity timeline items, with owner-only gating so users can only modify activities they created.

### Changes by File

| File | Change |
|------|--------|
| `src/lib/api/activities.ts` | Added `updateActivity()` and `deleteActivity()` DAL functions with owner-only enforcement (WHERE id + userId) |
| `src/lib/validators/activity.ts` | Added `updateActivitySchema` and `UpdateActivityInput` type — optional type, subject, body, duration fields |
| `src/app/api/activities/[id]/route.ts` | **New.** PATCH and DELETE handlers with auth, validation, owner-only 404 responses |
| `src/lib/hooks/use-activities.ts` | Added `useUpdateActivity()` and `useDeleteActivity()` React Query mutations with cache invalidation |
| `src/components/activities/activity-timeline.tsx` | Added `useCurrentUser` hook, passes `currentUserId` and `userId` to each `ActivityItem` |
| `src/components/activities/activity-item.tsx` | Converted to client component. Added inline edit mode (subject, body, duration fields), dropdown menu (Edit/Delete), `EDITABLE_TYPES` set, ownership check |

### Requirements Covered

| Requirement | Description | Status |
|-------------|-------------|--------|
| ACTV-01 | User can edit an activity they created | Done |
| ACTV-02 | User can delete an activity they created | Done |
| ACTV-03 | Edit/delete buttons appear only on activities created by the current user | Done |

### Design Decisions

- **Inline editing** over dialog — more natural for timeline items, avoids heavyweight modal for quick edits
- **EDITABLE_TYPES set** — system-generated activities (deal_stage_change, system_event, etc.) never show edit/delete controls
- **404 over 403** for non-owned activities — avoids leaking existence information
- **Owner-only gating at both API and UI levels** — defense in depth

### Commits

1. `feat(10a-activity-crud): task 1 - Add update/delete to activities DAL`
2. `feat(10a-activity-crud): task 2 - Add update activity validator`
3. `feat(10a-activity-crud): task 3 - Create /api/activities/[id] route`
4. `feat(10a-activity-crud): task 4 - Add update/delete hooks`
5. `feat(10a-activity-crud): task 5 - Pass currentUserId to ActivityItem`
6. `feat(10a-activity-crud): task 6 - Add edit/delete controls to ActivityItem`
