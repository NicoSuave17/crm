---
phase: 4
plan: "04a-edit-deal-dialog"
title: "Edit Deal Dialog + Wiring"
status: complete
completed_at: "2026-03-04"
commits:
  - "feat(04a-edit-deal-dialog): task 1 - extend deal validator with lostReason and nullable companyId"
  - "feat(04a-edit-deal-dialog): task 2 - add useDeal and useUpdateDeal hooks"
  - "feat(04a-edit-deal-dialog): task 3 - add getDealWithRelations and enrich GET response"
  - "feat(04a-edit-deal-dialog): task 4 - create EditDealDialog component"
  - "feat(04a-edit-deal-dialog): task 5 - create deal detail page with Edit button"
  - "feat(04a-edit-deal-dialog): task 6 - wire Edit option into deals list row dropdown"
---

# Summary: Edit Deal Dialog + Wiring

## What was built

### Task 1: Extended deal validator
- `updateDealSchema` in `src/lib/validators/deal.ts` now includes `lostReason` (string, optional, nullable) and `companyId` (uuid, optional, nullable) via `.extend()` on the partial schema.

### Task 2: Added `useDeal` and `useUpdateDeal` hooks
- `useDeal(id)` — fetches a single deal with all relations via `GET /api/deals/[id]`
- `useUpdateDeal()` — mutation hook for `PATCH /api/deals/[id]`, invalidates `["deals"]`, `["deals", id]`, and `["pipeline"]` queries on success

### Task 3: Enriched GET deal endpoint
- Created `getDealWithRelations()` in `src/lib/api/deals.ts` — joins deals with stages (including `isWon`, `isLost`, `probability`), pipelines, contacts, companies, and users (owner)
- Updated `GET /api/deals/[id]` route to use `getDealWithRelations` instead of `getDeal`

### Task 4: Created EditDealDialog component
- `src/components/deals/edit-deal-dialog.tsx` — follows the EditContactDialog pattern
- All fields: title, stageId (Select with color dots), contactId (ContactPicker), companyId (CompanyPicker, nullable), priority (Select), value, expectedMrr, expectedCloseDate (date input), description (Textarea), lostReason (Textarea, conditional)
- Fetches pipeline stages via `usePipelineWithDeals` to determine `isLost` flag on the selected stage
- `lostReason` field only appears when selected stage has `isLost=true`; value is cleared when switching away from a lost stage
- Pre-fills all fields from the `deal` prop via `useEffect` on open
- Uses `useUpdateDeal` mutation, shows toast on success/error, dialog stays open on error

### Task 5: Created deal detail page
- `src/app/(dashboard)/deals/[id]/page.tsx` — MVP deal detail page
- Left column (2/5): Deal info card (title, pipeline, stage badge with color, priority badge, value, expected MRR, expected close date, probability, description, lost reason, owner), Contact card (linked to `/contacts/[id]`), Company card (conditional)
- Right column (3/5): Tabs for Timeline and Stage History (placeholders for future plans 04b/04c)
- Header: Back to Pipeline button, Edit button that opens EditDealDialog
- Satisfies DEAL-01 and DDET-03

### Task 6: Wired Edit into deals list dropdown
- Added Edit dropdown item (with Pencil icon) before Delete in the deals list row dropdown
- Fetch-on-click pattern: fetches full deal with relations before opening the dialog
- Renders `EditDealDialog` outside the table, controlled by `editingDeal` state
- Satisfies DEAL-02

## Requirements satisfied
- DEAL-01: Edit from deal detail page
- DEAL-02: Edit from deals list row dropdown
- DEAL-03: Pre-fills all current deal values
- DEAL-04: All fields exposed (title, contactId, stageId, priority, value, expectedCloseDate, description, companyId, expectedMrr, lostReason)
- DEAL-05: Submits via PATCH to `/api/deals/[id]`
- DDET-03: Edit button on deal detail page

## Files modified
- `src/lib/validators/deal.ts` — extended updateDealSchema
- `src/lib/api/deals.ts` — added getDealWithRelations, added companies import
- `src/app/api/deals/[id]/route.ts` — switched to getDealWithRelations
- `src/lib/hooks/use-deals.ts` — added useDeal, useUpdateDeal
- `src/components/deals/edit-deal-dialog.tsx` — new component
- `src/app/(dashboard)/deals/[id]/page.tsx` — new page
- `src/app/(dashboard)/deals/page.tsx` — wired Edit option

## Build status
`npm run build` passes cleanly.
