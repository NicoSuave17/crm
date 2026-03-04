---
phase: 4
plan: "04c-deal-detail-entities-tags-fields"
title: "Deal Detail: Related Entities, Tags, and Custom Fields"
wave: 1
depends_on:
  - "04a-edit-deal-dialog"
files_modified:
  - src/app/(dashboard)/deals/[id]/page.tsx
  - src/lib/hooks/use-tags.ts
  - src/app/api/tags/deal/route.ts
  - src/app/api/tags/route.ts
  - src/components/deals/deal-tag-selector.tsx
files_read:
  - src/components/contacts/tag-selector.tsx
  - src/components/contacts/custom-fields-display.tsx
  - src/lib/api/tags.ts
  - src/lib/hooks/use-custom-fields.ts
  - src/app/api/custom-fields/route.ts
autonomous: true
requirements:
  - DDET-05
  - DDET-06
  - DDET-07
---

# Deal Detail: Related Entities, Tags, and Custom Fields

## Objective
Enrich the deal detail page with clickable contact/company cards (DDET-05), tag management using the `deal_tags` junction table (DDET-07), and custom field display and editing (DDET-06).

## Context -- What already exists

**Related entities (DDET-05):**
- The `getDealWithRelations()` function (from Plan 04a) returns `contactFirstName`, `contactLastName`, `contactAvatarUrl`, `contactEmail`, `contactId`, `companyName`, `companyDomain`, `companyId`.
- The deal detail page (from Plan 04a) already has placeholder sections for contact and company in the left column.
- Contact detail page: `/contacts/[id]` -- navigation target.
- Company detail page: `/companies/[id]` -- does NOT exist yet (Phase 7). Link should still be generated; it will 404 until Phase 7 builds the page.

**Tags (DDET-07):**
- `deal_tags` junction table exists in schema with `dealId` + `tagId` composite primary key.
- `tags` table exists with `id`, `name`, `color`.
- Data access functions exist in `src/lib/api/tags.ts`:
  - `getDealTags(dealId)` -- returns tags for a deal
  - `addTagToDeal(dealId, tagId)` -- inserts into `deal_tags`
  - `removeTagFromDeal(dealId, tagId)` -- deletes from `deal_tags`
  - `listTags()` -- returns all tags
- API routes for deal tags are INCOMPLETE:
  - `POST /api/tags` supports `{ contactId, tagId }` but NOT `{ dealId, tagId }`.
  - `DELETE /api/tags/contact` handles contact tag removal. No `DELETE /api/tags/deal` route.
- Hooks exist for contact tags but NOT deal tags:
  - `useAddTagToContact()`, `useRemoveTagFromContact()` in `src/lib/hooks/use-tags.ts`.
  - No `useAddTagToDeal()`, `useRemoveTagFromDeal()`.
- The `TagSelector` component at `src/components/contacts/tag-selector.tsx` works with `contactId`. A deal-specific variant is needed.

**Custom fields (DDET-06):**
- `CustomFieldsDisplay` component at `src/components/contacts/custom-fields-display.tsx` is entity-agnostic. It accepts `entityId` and fetches/displays custom field values for that entity. It works for deals out of the box.
- `useFieldValues(entityId)` hook fetches field values.
- `useSetFieldValue()` hook saves field values.
- Custom field definitions are filtered by `entityType` ("deal") when fetching.
- **This component is already reusable for deals.** Just render `<CustomFieldsDisplay entityId={dealId} />`.

## Pre-flight checks
Before writing code, confirm:
1. `src/lib/api/tags.ts` -- confirm `addTagToDeal`, `removeTagFromDeal`, `getDealTags` exist (confirmed)
2. `src/app/api/tags/route.ts` -- confirm POST only handles contact tags (confirmed: checks `body.contactId && body.tagId`)
3. `src/components/contacts/tag-selector.tsx` -- understand the Popover pattern (read)
4. `src/components/contacts/custom-fields-display.tsx` -- confirm it's entity-agnostic (confirmed)
5. The deal detail page from Plan 04a -- understand its current structure

<tasks>

<task id="1">
**Add deal tag API routes.**

**Option A (extend existing route):** Modify `POST /api/tags` to also handle `{ dealId, tagId }`. In `src/app/api/tags/route.ts`, add:

```ts
// Assign tag to deal
if (body.dealId && body.tagId) {
  await addTagToDeal(body.dealId, body.tagId);
  return NextResponse.json({ success: true });
}
```

Import `addTagToDeal` from `@/lib/api/tags`.

**Create `DELETE /api/tags/deal/route.ts`** (mirrors the existing `DELETE /api/tags/contact/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { removeTagFromDeal } from "@/lib/api/tags";

export async function DELETE(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    if (!body.dealId || !body.tagId) {
      return NextResponse.json(
        { error: "dealId and tagId required" },
        { status: 400 }
      );
    }

    await removeTagFromDeal(body.dealId, body.tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```
</task>

<task id="2">
**Add deal tag hooks.**

In `src/lib/hooks/use-tags.ts`, add:

```ts
export function useAddTagToDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; tagId: string }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useRemoveTagFromDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; tagId: string }) => {
      const res = await fetch("/api/tags/deal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to remove tag");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}
```

These invalidate the `["deals"]` query key so the deal detail page refreshes to show updated tags.
</task>

<task id="3">
**Create `DealTagSelector` component.**

Create `src/components/deals/deal-tag-selector.tsx`, following the same pattern as `src/components/contacts/tag-selector.tsx`.

```ts
interface DealTagSelectorProps {
  dealId: string;
  currentTags: { id: string; name: string; color: string }[];
}
```

The implementation is nearly identical to `TagSelector` but uses:
- `useAddTagToDeal()` instead of `useAddTagToContact()`
- `useRemoveTagFromDeal()` instead of `useRemoveTagFromContact()`
- Passes `dealId` instead of `contactId`

Same UI: badge list with X remove buttons, plus an "Add" Popover showing all tags with checkmarks for active ones.
</task>

<task id="4">
**Enrich deal detail page with related entity data (DDET-05).**

The `getDealWithRelations()` response (from Plan 04a) already includes contact and company data. Modify the deal detail page to render:

**Fetch deal tags:** The deal data from `getDealWithRelations` does NOT include tags. Either:
- Add a separate `getDealTags(id)` call in the API route and merge the result, or
- Fetch tags client-side with a new `useDealTags(dealId)` hook.

**Recommended:** Add tags to the `getDealWithRelations` response. In `src/lib/api/deals.ts`, after the main query, fetch tags:
```ts
export async function getDealWithRelations(id: string) {
  const [deal] = await db.select({...}).from(deals)...;
  if (!deal) return null;

  const dealTagsList = await getDealTags(id);

  return { ...deal, tags: dealTagsList };
}
```

**Contact card (left column):**
```tsx
{deal.contactId && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium">Contact</CardTitle>
    </CardHeader>
    <CardContent>
      <Link
        href={`/contacts/${deal.contactId}`}
        className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={deal.contactAvatarUrl ?? undefined} />
          <AvatarFallback>
            {getInitials(deal.contactFirstName, deal.contactLastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">
            {deal.contactFirstName} {deal.contactLastName}
          </p>
          {deal.contactEmail && (
            <p className="text-xs text-muted-foreground">{deal.contactEmail}</p>
          )}
        </div>
      </Link>
    </CardContent>
  </Card>
)}
```

**Company card (left column):**
```tsx
{deal.companyId && deal.companyName && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium">Company</CardTitle>
    </CardHeader>
    <CardContent>
      <Link
        href={`/companies/${deal.companyId}`}
        className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{deal.companyName}</p>
          {deal.companyDomain && (
            <p className="text-xs text-muted-foreground">{deal.companyDomain}</p>
          )}
        </div>
      </Link>
    </CardContent>
  </Card>
)}
```

These are clickable cards that navigate to the respective detail pages.
</task>

<task id="5">
**Add tag management to the deal detail page (DDET-07).**

In the deal detail page left column (within the profile card or as a separate section), render the `DealTagSelector`:

```tsx
<Separator className="my-4" />
<DealTagSelector
  dealId={id}
  currentTags={deal.tags ?? []}
/>
```

This gives users the ability to add and remove tags from the deal using the `deal_tags` junction table.

The tag selector shows:
- Current tags as colored badges with X remove buttons
- "Add" button that opens a Popover with all available tags
- Tags already on the deal show a checkmark; clicking toggles add/remove
</task>

<task id="6">
**Add custom fields display to the deal detail page (DDET-06).**

The `CustomFieldsDisplay` component is already entity-agnostic. Add it to the deal detail page left column:

```tsx
<Separator className="my-4" />
<CustomFieldsDisplay entityId={id} />
```

This will:
- Fetch custom field values for the deal entity using `useFieldValues(id)`
- Display each field with its label and current value
- Allow inline editing (pencil icon -> input -> save/cancel)
- Only show if there are custom field values defined for this entity

No additional code changes needed for the component itself -- it already handles all field types (text, number, date, boolean, etc.) and the save/edit flow.

**Note:** Custom field definitions must have `entityType: "deal"` to appear for deals. If no deal-scoped custom fields are defined yet, the section will be empty (component returns `null` when no values exist). This is correct behavior.
</task>

</tasks>

## Verification
- [ ] `POST /api/tags` with `{ dealId, tagId }` adds a tag to a deal
- [ ] `DELETE /api/tags/deal` with `{ dealId, tagId }` removes a tag from a deal
- [ ] `useAddTagToDeal()` and `useRemoveTagFromDeal()` hooks work and invalidate deal queries
- [ ] `DealTagSelector` shows current tags, supports add/remove (DDET-07)
- [ ] Contact card on deal detail page is clickable, navigates to `/contacts/[contactId]` (DDET-05)
- [ ] Company card on deal detail page is clickable, navigates to `/companies/[companyId]` (DDET-05)
- [ ] Company card only renders when `companyId` is set
- [ ] `CustomFieldsDisplay` renders on deal detail page with inline editing (DDET-06)
- [ ] Custom fields section is hidden when no deal-scoped custom field values exist
- [ ] Tags from `getDealWithRelations` are included in the deal response
- [ ] No regression: contact detail page `TagSelector` still works
- [ ] No regression: contact detail page `CustomFieldsDisplay` still works
- [ ] `npm run build` passes

## must_haves
- Deal tag API routes complete the CRUD loop: add and remove tags via `deal_tags` table
- `DealTagSelector` follows the same Popover pattern as the contact `TagSelector`
- Contact and company cards are clickable `<Link>` elements that navigate to detail pages (DDET-05)
- Contact card shows avatar, name, and email
- Company card shows icon, name, and domain
- `CustomFieldsDisplay` reused as-is for deals (DDET-06) -- no duplication
- Tags included in the `getDealWithRelations` response so the detail page has them on first render
- All hooks invalidate appropriate query keys on success

## PLANNING COMPLETE
