---
phase: 4
plan: "04b-deal-detail-timeline-history"
title: "Deal Detail: Activity Timeline + Stage History + Log Activity"
status: complete
started: "2026-03-04"
completed: "2026-03-04"
---

# Summary: Deal Detail: Activity Timeline + Stage History + Log Activity

## What was done

### Task 1: Create deal_stage_history table in schema
- Added `dealStageHistory` table to `src/lib/db/schema.ts` with columns: id, dealId, fromStageId, toStageId, userId, changedAt
- Added index on dealId for query performance
- Added `dealStageHistoryRelations` with relations to deals, pipelineStages (fromStage/toStage via relationName), and users
- Added `stageHistory: many(dealStageHistory)` to `dealsRelations`
- Ran `npx drizzle-kit push` to apply schema

### Task 2: Record stage history in deal mutations
- `createDeal()`: Records initial stage entry (fromStageId=null, toStageId=data.stageId)
- `moveDeal()`: Records from/to stage transition after updating the deal
- `updateDeal()`: Now accepts optional `userId` parameter; if `data.stageId` is present and differs from current, records stage history
- PATCH API route now passes `user.id` to `updateDeal()`

### Task 3: Add getStageHistory() API endpoint and hook
- `getStageHistory(dealId)` in `src/lib/api/deals.ts`: Fetches stage history rows, resolves stage names/colors via a second query, returns enriched records with fromStageName, fromStageColor, toStageName, toStageColor
- `GET /api/deals/[id]/history` route at `src/app/api/deals/[id]/history/route.ts`
- `useStageHistory(dealId)` hook in `src/lib/hooks/use-deals.ts`

### Task 4: Update ActivityTimeline for deal-only mode
- Made `contactId` optional in `ActivityTimeline` interface (was required)
- When `dealId` is provided, filters activities by `dealId` instead of `contactId`
- Made `contactId` optional in `ActivityForm` interface
- Backward compatible: contact detail page still passes `contactId` only and works unchanged

### Task 5: Add timeline and stage history tabs to deal detail page
- Created `StageHistoryList` component at `src/components/deals/stage-history-list.tsx`
  - Vertical timeline UI with colored stage dots (CircleDot icon)
  - Shows "Created in [Stage]" for initial entry (no fromStage)
  - Shows "[From Stage] -> [To Stage]" for transitions with ArrowRight icon
  - Relative timestamps via date-fns `formatDistanceToNow`
  - Loading skeletons and empty state
- Wired `ActivityTimeline` into Timeline tab with `contactId={deal.contactId} dealId={id}`
- Wired `StageHistoryList` into Stage History tab

### Task 6: Add Log Activity button to deal detail header
- Added "Log Activity" button with MessageSquare icon next to Edit button
- Tabs now controlled via `activeTab` state
- Clicking "Log Activity" switches to the Timeline tab where the ActivityForm is visible

## Files modified
- `src/lib/db/schema.ts` - Added dealStageHistory table + relations
- `src/lib/api/deals.ts` - Added getStageHistory(), updated createDeal/moveDeal/updateDeal
- `src/app/api/deals/[id]/route.ts` - Pass user.id to updateDeal
- `src/app/api/deals/[id]/history/route.ts` - New GET endpoint (created)
- `src/lib/hooks/use-deals.ts` - Added useStageHistory hook
- `src/components/activities/activity-timeline.tsx` - Made contactId optional
- `src/components/activities/activity-form.tsx` - Made contactId optional
- `src/components/deals/stage-history-list.tsx` - New component (created)
- `src/app/(dashboard)/deals/[id]/page.tsx` - Wired everything together

## Verification
- [x] `deal_stage_history` table created with migration applied
- [x] `createDeal()` records initial stage in history
- [x] `moveDeal()` records from/to stage transition in history
- [x] `updateDeal()` records stage change when `stageId` changes
- [x] `GET /api/deals/[id]/history` returns stage history for a deal
- [x] `useStageHistory(dealId)` hook fetches and caches stage history
- [x] Activity timeline shows on deal detail page filtered by `dealId` (DDET-01)
- [x] ActivityForm on the timeline tab pre-fills both `dealId` and `contactId` (DDET-04)
- [x] Stage history tab shows chronological list of stage transitions with stage names and timestamps (DDET-02)
- [x] Stage history shows creation entry (first stage assignment with no "from" stage)
- [x] `ActivityTimeline` component works with optional `contactId` (no regression on contact detail page)
- [x] `npm run build` passes
