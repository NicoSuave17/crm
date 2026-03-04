---
phase: 4
plan: "04b-deal-detail-timeline-history"
title: "Deal Detail: Activity Timeline + Stage History + Log Activity"
wave: 1
depends_on:
  - "04a-edit-deal-dialog"
files_modified:
  - src/app/(dashboard)/deals/[id]/page.tsx
  - src/lib/db/schema.ts
  - src/lib/api/deals.ts
  - src/app/api/deals/[id]/route.ts
files_read:
  - src/components/activities/activity-timeline.tsx
  - src/components/activities/activity-form.tsx
  - src/lib/hooks/use-activities.ts
  - src/lib/api/activities.ts
autonomous: true
requirements:
  - DDET-01
  - DDET-02
  - DDET-04
---

# Deal Detail: Activity Timeline + Stage History + Log Activity

## Objective
Add a live activity timeline, stage history tracking, and a "Log Activity" button to the deal detail page, making it a fully functional deal workspace.

## Context -- What already exists

**Activity timeline (fully built for contacts, reusable for deals):**
- `ActivityTimeline` component at `src/components/activities/activity-timeline.tsx` -- accepts `contactId` and optional `dealId` props.
- `ActivityForm` at `src/components/activities/activity-form.tsx` -- accepts `contactId` and optional `dealId`. Creates activities with both IDs.
- `useActivities({ dealId })` hook -- already supports filtering by `dealId`. The `enabled` check is `!!(params.contactId || params.dealId)`, so it works with just `dealId`.
- `GET /api/activities?dealId=X` -- already supported in the API route.
- `useCreateActivity()` -- already works, invalidates `["activities"]`.

**Problem:** The `ActivityTimeline` component currently requires `contactId` as a mandatory prop. For the deal detail page, we need it to work with just `dealId` (a deal always has a `contactId` we can pass, but it should filter by `dealId` not `contactId` to show only deal-specific activities).

**Stage history (does NOT exist yet):**
- There is NO `deal_stage_history` table in the schema.
- The `moveDeal()` function in `src/lib/api/deals.ts` logs a `deal_stage_change` activity when a deal moves stages, but does NOT write to a dedicated history table.
- Two approaches:
  - **Option A (recommended):** Create a `deal_stage_history` table and populate it in `moveDeal()` and `createDeal()`. Query it for the stage history display.
  - **Option B:** Derive stage history from activities where `type === 'deal_stage_change'` and `dealId` matches. Simpler but less structured -- activities don't store the from/to stage IDs, only the subject text.

**Decision:** Go with Option A. A dedicated `deal_stage_history` table gives us structured from/to stage data, timestamps, and who made the change. This is more reliable than parsing activity subject strings.

## Pre-flight checks
Before writing any code, confirm:
1. `src/components/activities/activity-timeline.tsx` -- confirm `contactId` is required (it is in the interface, needs to become optional)
2. `src/components/activities/activity-form.tsx` -- confirm it accepts `dealId` (it does)
3. `src/lib/hooks/use-activities.ts` -- confirm `dealId` filtering works (it does)
4. `src/lib/db/schema.ts` -- confirm no `deal_stage_history` table exists (confirmed: none)

<tasks>

<task id="1">
**Create the `deal_stage_history` table in the schema.**

In `src/lib/db/schema.ts`, add after the `deals` table definition (before Activities section):

```ts
export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
    fromStageId: uuid("from_stage_id").references(() => pipelineStages.id),
    toStageId: uuid("to_stage_id")
      .references(() => pipelineStages.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (t) => [index("idx_deal_stage_history_deal").on(t.dealId)]
);
```

Add relations:
```ts
export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
  fromStage: one(pipelineStages, { fields: [dealStageHistory.fromStageId], references: [pipelineStages.id], relationName: "fromStage" }),
  toStage: one(pipelineStages, { fields: [dealStageHistory.toStageId], references: [pipelineStages.id], relationName: "toStage" }),
  user: one(users, { fields: [dealStageHistory.userId], references: [users.id] }),
}));
```

Also add `stageHistory: many(dealStageHistory)` to `dealsRelations`.

After modifying the schema, run `npx drizzle-kit push` to sync the database.
</task>

<task id="2">
**Record stage history in `moveDeal()` and `createDeal()`.**

In `src/lib/api/deals.ts`:

1. Import `dealStageHistory` from schema.

2. In `createDeal()`, after inserting the deal, also record the initial stage:
```ts
await db.insert(dealStageHistory).values({
  dealId: deal.id,
  fromStageId: null, // no previous stage on creation
  toStageId: data.stageId,
  userId: ownerId,
});
```

3. In `moveDeal()`, after updating the deal's stageId, record the stage transition:
```ts
await db.insert(dealStageHistory).values({
  dealId: id,
  fromStageId: existing.stageId,
  toStageId: stageId,
  userId,
});
```

4. In `updateDeal()`, if `data.stageId` is present and differs from the current stage, also record the transition. This requires fetching the current deal first:
```ts
export async function updateDeal(id: string, data: UpdateDealInput, userId?: string) {
  // If stageId is being changed, record stage history
  if (data.stageId) {
    const existing = await getDeal(id);
    if (existing && existing.stageId !== data.stageId) {
      await db.insert(dealStageHistory).values({
        dealId: id,
        fromStageId: existing.stageId,
        toStageId: data.stageId,
        userId: userId ?? null,
      });
    }
  }

  const [deal] = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return deal;
}
```

Update the PATCH route to pass `user.id` to `updateDeal()`:
```ts
const deal = await updateDeal(id, parsed.data, user.id);
```
</task>

<task id="3">
**Add `getStageHistory()` data access function and API endpoint.**

In `src/lib/api/deals.ts`, add:

```ts
export async function getStageHistory(dealId: string) {
  const fromStages = db.$with("from_stages").as(
    db.select({ id: pipelineStages.id, name: pipelineStages.name, color: pipelineStages.color })
      .from(pipelineStages)
  );

  // Simpler approach: two separate joins
  return db
    .select({
      id: dealStageHistory.id,
      dealId: dealStageHistory.dealId,
      fromStageId: dealStageHistory.fromStageId,
      toStageId: dealStageHistory.toStageId,
      userId: dealStageHistory.userId,
      changedAt: dealStageHistory.changedAt,
    })
    .from(dealStageHistory)
    .where(eq(dealStageHistory.dealId, dealId))
    .orderBy(desc(dealStageHistory.changedAt));
}
```

Since Drizzle doesn't easily support joining the same table twice with aliases, the simplest approach is to fetch the stage history rows, then resolve stage names client-side from the pipeline stages data. Alternatively, use raw SQL or two queries.

**Recommended approach:** Return stage history with IDs + timestamps. The deal detail page already has access to pipeline stages (from the `getDealWithRelations` response or a separate stages fetch). The component can resolve stage names from a stages map.

Add a GET endpoint or extend the existing deal GET. Simplest: add a query parameter to `GET /api/deals/[id]?include=stageHistory`:
- If the detail page already fetches stages for the pipeline, it can resolve names.

**Alternative (simpler):** Add a new API route `GET /api/deals/[id]/history` that returns stage history with resolved names:

```ts
// src/app/api/deals/[id]/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { getStageHistory } from "@/lib/api/deals";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const history = await getStageHistory(id);
    return NextResponse.json(history);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Add a `useStageHistory(dealId)` hook in `src/lib/hooks/use-deals.ts`:
```ts
export function useStageHistory(dealId: string) {
  return useQuery({
    queryKey: ["deals", dealId, "stage-history"],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/history`);
      if (!res.ok) throw new Error("Failed to fetch stage history");
      return res.json();
    },
    enabled: !!dealId,
  });
}
```
</task>

<task id="4">
**Update ActivityTimeline to support deal-only mode (DDET-01).**

The `ActivityTimeline` component at `src/components/activities/activity-timeline.tsx` requires `contactId`. For the deal detail page, we want to filter by `dealId`.

Modify the interface to make `contactId` optional:

```ts
interface ActivityTimelineProps {
  contactId?: string;
  dealId?: string;
}
```

Update `useActivities` call to pass whichever ID is provided:
```ts
const { data: activities, isLoading } = useActivities({
  contactId,
  dealId,
});
```

The `useActivities` hook already handles `dealId` and its `enabled` check already supports `!!(params.contactId || params.dealId)`.

Also update `ActivityForm` props to make `contactId` optional:
```ts
interface ActivityFormProps {
  contactId?: string;
  dealId?: string;
  onSuccess?: () => void;
}
```

**Important:** When logging an activity from the deal detail page, we should still associate the activity with the deal's contact. The deal detail page knows the `contactId` from the deal data, so pass both:
```tsx
<ActivityTimeline contactId={deal.contactId} dealId={deal.id} />
```

But the filtering should be by `dealId` to show only deal-relevant activities. Modify the `ActivityTimeline` to prefer `dealId` filtering when present:
```ts
const { data: activities, isLoading } = useActivities(
  dealId ? { dealId } : { contactId: contactId! }
);
```

The `ActivityForm` should still send both `contactId` and `dealId` so the activity is linked to both entities.
</task>

<task id="5">
**Add stage history and activity timeline tabs to the deal detail page.**

Modify `src/app/(dashboard)/deals/[id]/page.tsx` (created in Plan 04a):

Add a Tabs component in the right column with three tabs:

**Tab 1: Timeline (DDET-01)**
```tsx
<TabsContent value="timeline">
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Activity Timeline</CardTitle>
      <CardDescription>All interactions for this deal</CardDescription>
    </CardHeader>
    <CardContent>
      <ActivityTimeline contactId={deal.contactId} dealId={id} />
    </CardContent>
  </Card>
</TabsContent>
```

This reuses the existing `ActivityTimeline` component which includes the `ActivityForm` inline. The form already has `dealId` support. This satisfies DDET-01 (activity timeline) and DDET-04 (Log Activity button -- the ActivityForm IS the log activity UI, pre-filled with `dealId`).

**Tab 2: Stage History (DDET-02)**
```tsx
<TabsContent value="history">
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Stage History</CardTitle>
      <CardDescription>Progression through pipeline stages</CardDescription>
    </CardHeader>
    <CardContent>
      <StageHistoryList dealId={id} stages={stages} />
    </CardContent>
  </Card>
</TabsContent>
```

Create an inline `StageHistoryList` component (or a separate file at `src/components/deals/stage-history-list.tsx`):
- Uses `useStageHistory(dealId)` to fetch stage transitions
- Renders a vertical timeline of stage changes with:
  - Stage name (resolve from stages map or directly from API if enriched)
  - Timestamp (relative time, e.g., "2 days ago")
  - Arrow indicator: "from Stage A -> to Stage B"
  - First entry (creation) shows just "to Stage B" with no "from"
- Empty state: "No stage changes recorded"

**Note on stage name resolution:** If `getStageHistory()` returns only IDs, fetch stages for the pipeline and build a lookup map. The deal detail page can fetch stages via a query like `GET /api/pipelines/[pipelineId]/stages` or embed them in the deal response.

Simplest approach: include stage names directly in the `getStageHistory()` query using subqueries or by doing a second query. Or store stage names in the history table (denormalized) for simplicity. **Recommended:** Use two aliased joins in the query or do a simple post-fetch resolution.
</task>

<task id="6">
**Add "Log Activity" button to deal detail page header (DDET-04).**

The ActivityTimeline component already includes an ActivityForm at the top with a "Log Activity" submit button. This inherently satisfies DDET-04 since:
- The form is pre-filled with `dealId` (passed as prop)
- The form is pre-filled with `contactId` (passed as `deal.contactId`)

However, if the design calls for a standalone "Log Activity" button in the page header (outside the timeline tab), add a button that scrolls to or focuses the activity form, or opens a dialog variant.

**Simpler approach (recommended):** The ActivityForm within the Timeline tab IS the "Log Activity" feature. The tab label "Timeline" makes it clear. No separate button needed unless the user specifically requests a header-level shortcut.

If a header button is desired, add it next to the Edit button:
```tsx
<Button variant="outline" size="sm" onClick={() => setActiveTab("timeline")}>
  <MessageSquare className="mr-2 h-4 w-4" />
  Log Activity
</Button>
```

This switches to the Timeline tab where the form is visible.
</task>

</tasks>

## Verification
- [ ] `deal_stage_history` table created with migration applied
- [ ] `createDeal()` records initial stage in history
- [ ] `moveDeal()` records from/to stage transition in history
- [ ] `updateDeal()` records stage change when `stageId` changes
- [ ] `GET /api/deals/[id]/history` returns stage history for a deal
- [ ] `useStageHistory(dealId)` hook fetches and caches stage history
- [ ] Activity timeline shows on deal detail page filtered by `dealId` (DDET-01)
- [ ] ActivityForm on the timeline tab pre-fills both `dealId` and `contactId` (DDET-04)
- [ ] Stage history tab shows chronological list of stage transitions with stage names and timestamps (DDET-02)
- [ ] Stage history shows creation entry (first stage assignment with no "from" stage)
- [ ] `ActivityTimeline` component works with optional `contactId` (no regression on contact detail page)
- [ ] `npm run build` passes

## must_haves
- `deal_stage_history` table in schema with proper references, indexes, and cascade delete
- Stage history recorded on deal creation, deal stage move, and deal update (when stageId changes)
- Activity timeline on deal detail page filters by `dealId`, not `contactId` (DDET-01)
- ActivityForm pre-fills `dealId` so logged activities are linked to the deal (DDET-04)
- Stage history display shows stage name, timestamp, and from/to progression (DDET-02)
- `ActivityTimeline` component remains backward-compatible with contact detail page usage
- No manual schema SQL -- use `drizzle-kit push` after schema changes

## PLANNING COMPLETE
