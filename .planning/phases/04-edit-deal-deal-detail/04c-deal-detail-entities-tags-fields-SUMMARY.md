---
phase: 4
plan: "04c-deal-detail-entities-tags-fields"
title: "Deal Detail: Related Entities, Tags, and Custom Fields"
status: complete
completed_at: "2026-03-04"
commits:
  - "feat(04c-entities-tags-fields): task 1 - add deal tag API routes"
  - "feat(04c-entities-tags-fields): task 2 - add deal tag hooks"
  - "feat(04c-entities-tags-fields): task 3 - create DealTagSelector component"
  - "feat(04c-entities-tags-fields): task 4 - enrich deal detail with related entities"
  - "feat(04c-entities-tags-fields): task 5 - add tag management to deal detail page"
  - "feat(04c-entities-tags-fields): task 6 - add custom fields display to deal detail page"
---

# Summary: Deal Detail - Related Entities, Tags, and Custom Fields

## What was built

### Task 1: Deal tag API routes
- Extended `POST /api/tags` to handle `{ dealId, tagId }` for assigning tags to deals (in addition to existing contact tag assignment).
- Created `DELETE /api/tags/deal/route.ts` mirroring the existing contact tag removal route pattern.

### Task 2: Deal tag hooks
- Added `useAddTagToDeal()` mutation hook calling `POST /api/tags` with dealId.
- Added `useRemoveTagFromDeal()` mutation hook calling `DELETE /api/tags/deal`.
- Both hooks invalidate `["deal"]` and `["deals"]` query keys on success.

### Task 3: DealTagSelector component
- Created `src/components/deals/deal-tag-selector.tsx` following the same Popover pattern as the contact `TagSelector`.
- Shows current tags as colored badges with X remove buttons.
- "Add" button opens a Popover listing all available tags with checkmarks for active ones.
- Clicking toggles add/remove via the deal tag hooks.

### Task 4: Related entity cards (DDET-05)
- Updated `getDealWithRelations()` in `src/lib/api/deals.ts` to fetch and include tags via `getDealTags(id)`.
- Made the company card a clickable `<Link>` navigating to `/companies/[companyId]` with hover state.
- Contact card was already a clickable Link from plan 04a.
- Both cards display avatar/icon, name, and secondary info (email/domain).

### Task 5: Tag management on deal detail (DDET-07)
- Rendered `DealTagSelector` in the deal info card after the Owner section with a Separator.
- Tags are passed from the `getDealWithRelations` response as `currentTags`.

### Task 6: Custom fields display on deal detail (DDET-06)
- Reused the entity-agnostic `CustomFieldsDisplay` component from `src/components/contacts/custom-fields-display.tsx`.
- Rendered with `entityId={id}` in the deal info card after the tags section.
- Component automatically fetches deal-scoped custom field values and supports inline editing.
- Returns null when no custom field values exist (correct empty state).

## Files modified
- `src/app/api/tags/route.ts` — extended POST handler for deal tags
- `src/app/api/tags/deal/route.ts` — new DELETE route for deal tag removal
- `src/lib/hooks/use-tags.ts` — added useAddTagToDeal, useRemoveTagFromDeal
- `src/components/deals/deal-tag-selector.tsx` — new DealTagSelector component
- `src/lib/api/deals.ts` — getDealWithRelations now includes tags
- `src/app/(dashboard)/deals/[id]/page.tsx` — added entity links, tags, custom fields

## Verification
- Build passes (`npm run build`)
- All 6 tasks committed atomically
