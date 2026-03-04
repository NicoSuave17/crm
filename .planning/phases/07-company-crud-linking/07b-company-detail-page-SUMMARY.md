# Phase 7b: Company Detail Page + Edit/Delete - SUMMARY

**Status:** Complete
**Date:** 2026-03-05

---

## What Was Built

### Task 1: Extend ActivityTimeline for companyId support
- Added `companyId` prop to `ActivityTimeline` and `ActivityForm` components
- Extended `useActivities` hook to pass `companyId` query param
- API route and DAL already supported `companyId` -- no backend changes needed

### Task 2: Extend deals filtering for companyId
- Added `companyId` to `listDeals()` DAL filter conditions
- Extended `useDeals` hook to pass `companyId` query param
- Extended `GET /api/deals` route to extract `companyId` from searchParams

### Task 3: Add defaultCompanyId to DealForm
- Added `defaultCompanyId` prop to `DealForm` component
- Passed `companyId` in the `createDeal` mutation payload when provided

### Task 4: Create CompanyDealsTab component
- New `src/components/companies/company-deals-tab.tsx`
- Table with linked deal titles, stage badges, value, priority, expected close date
- "Add Deal" button opens DealForm with `defaultCompanyId` pre-filled
- Loading skeleton rows and empty state

### Task 5: Create company detail page
- New `src/app/(dashboard)/companies/[id]/page.tsx`
- **Profile card:** Building2 icon, company name, clickable domain, industry/size badges, description, website/LinkedIn links, owner avatar+name, custom fields display
- **Stats card:** Linked contacts count (from DAL), created date
- **Tabs:** Timeline (ActivityTimeline with companyId), Deals (CompanyDealsTab), Contacts (placeholder for 07c)
- **Top bar:** Back to Companies, Edit button (opens EditCompanyDialog), Delete button (AlertDialog confirmation -> redirect)
- **Loading state:** Skeleton layout matching the grid
- **Not found state:** "Company not found" with back button
- Added `alert-dialog` shadcn component for delete confirmation

---

## Files Created
- `src/app/(dashboard)/companies/[id]/page.tsx`
- `src/components/companies/company-deals-tab.tsx`
- `src/components/ui/alert-dialog.tsx`

## Files Modified
- `src/components/activities/activity-timeline.tsx` -- added `companyId` prop
- `src/components/activities/activity-form.tsx` -- added `companyId` prop
- `src/lib/hooks/use-activities.ts` -- added `companyId` support
- `src/lib/api/deals.ts` -- added `companyId` filter to `listDeals`
- `src/lib/hooks/use-deals.ts` -- added `companyId` param
- `src/app/api/deals/route.ts` -- extract `companyId` from searchParams
- `src/components/pipeline/deal-form.tsx` -- added `defaultCompanyId` prop

## Requirements Covered
| Requirement | Description | Status |
|-------------|-------------|--------|
| COMP-03 | View company detail page | Complete |
| COMP-04 | Edit a company's details | Complete (uses EditCompanyDialog from 7a) |
| COMP-05 | Delete a company | Complete (AlertDialog confirmation + redirect) |

## Notes
- Contacts tab is a placeholder pending 07c (contact-company linking)
- CustomFieldsDisplay reused as-is -- it works by entityId which is already unique
- Build passes with zero errors
