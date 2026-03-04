# Phase 7b: Company Detail Page + Edit/Delete

**Requirements:** COMP-03, COMP-04, COMP-05
**Scope:** Company detail page with profile card, related entities sections (deals, activity timeline), custom fields display, edit dialog, and delete with confirmation.
**Wave:** 2 (depends on 7a for DAL, routes, hooks, and edit dialog)
**Note:** COMP-04 (edit) and COMP-05 (delete) are largely handled in 7a (edit dialog, delete route/hook/row action). This plan covers the detail page integration of those actions and the remaining COMP-03 work.

---

## Current State Assessment

### What exists after 7a completes:
- **`getCompany(id)`** DAL — Returns full company with owner info and contactCount
- **`GET /api/companies/[id]`** route — Returns company detail JSON
- **`PATCH /api/companies/[id]`** route — Updates company
- **`DELETE /api/companies/[id]`** route — Deletes company
- **`useCompany(id)`** hook — Fetches single company
- **`useUpdateCompany()`** hook — PATCH mutation
- **`useDeleteCompany()`** hook — DELETE mutation
- **`EditCompanyDialog`** component — Edit form dialog
- **`CompanyForm`** component — Create form dialog
- **Companies list page** at `/companies` — With working links to `/companies/[id]`

### What exists from earlier phases (reusable):
- **`ActivityTimeline`** (`src/components/activities/activity-timeline.tsx`) — Accepts `contactId` prop. For company detail, we need a `companyId` prop. Must verify if this component already supports it or needs extension.
- **`CustomFieldsDisplay`** (`src/components/contacts/custom-fields-display.tsx`) — Currently renders custom fields for a given `entityId`. Custom field definitions are scoped by `entityType` (contact, deal, company). Must verify this component accepts or can accept `entityType` prop.
- **Contact detail page** (`src/app/(dashboard)/contacts/[id]/page.tsx`) — Reference pattern for profile card + tabs layout.
- **`useDeals({ companyId })`** — Need to verify if deals hook supports `companyId` filter. The deals table has `companyId` column, but the `listDeals` DAL may not filter by it yet.

### What needs investigation:

**ActivityTimeline companyId support:**
Need to check if `ActivityTimeline` and the underlying `useActivities` hook support `companyId`. If not, the hook and API need a small extension.

**CustomFieldsDisplay entityType support:**
Need to check if `CustomFieldsDisplay` passes `entityType: "company"` or defaults to "contact". If it's hardcoded, we need to add an `entityType` prop.

**Deals by companyId:**
Need to check if `listDeals` / `useDeals` support `companyId` filter. The deals schema has `companyId`, but the DAL may not expose this filter.

---

## Pre-Implementation Investigation

Before starting implementation, verify these three things:

1. **Read** `src/components/activities/activity-timeline.tsx` — Check if it accepts `companyId` prop. Check the underlying hook/API.
2. **Read** `src/components/contacts/custom-fields-display.tsx` — Check if it accepts `entityType` prop or hardcodes "contact".
3. **Read** `src/lib/api/deals.ts` — Check if `listDeals` accepts `companyId` filter param.
4. **Read** `src/lib/hooks/use-deals.ts` — Check if `useDeals` passes `companyId` to the API.

Based on findings, some of the steps below may need to include small extensions to these existing components.

---

## Implementation Steps

### Step 1: Extend ActivityTimeline to support companyId (if needed)
**Files:** May need edits to:
- `src/components/activities/activity-timeline.tsx`
- `src/lib/hooks/use-activities.ts`
- `src/lib/api/activities.ts`
- `src/app/api/activities/route.ts`

**If ActivityTimeline only accepts `contactId`:**
1. Add `companyId?: string` prop to `ActivityTimeline`
2. Pass `companyId` to the `useActivities()` hook call
3. In the hook, include `companyId` in the query params
4. In the API route GET handler, extract `companyId` from searchParams and pass to `listActivities()`
5. In the `listActivities()` DAL, add `if (companyId) conditions.push(eq(activities.companyId, companyId))`

**If it already supports companyId:** Skip this step.

### Step 2: Extend CustomFieldsDisplay for company entityType (if needed)
**Files:** May need edits to:
- `src/components/contacts/custom-fields-display.tsx`

**If it hardcodes entityType to "contact":**
1. Add `entityType?: "contact" | "deal" | "company"` prop (defaulting to "contact")
2. Pass `entityType` to the API call that fetches custom field definitions

**If it already supports entityType:** Skip this step.

### Step 3: Extend deals filtering to support companyId (if needed)
**Files:** May need edits to:
- `src/lib/api/deals.ts` — Add `companyId` to `DealListParams` and filter conditions
- `src/lib/hooks/use-deals.ts` — Pass `companyId` param
- `src/app/api/deals/route.ts` — Extract `companyId` from searchParams

**If already supported:** Skip this step.

### Step 4: Company detail page
**File:** `src/app/(dashboard)/companies/[id]/page.tsx` (new)

Follow the contact detail page pattern (`src/app/(dashboard)/contacts/[id]/page.tsx`) with adaptations for company data.

**Layout:** 5-column grid: 2-col left (profile), 3-col right (tabs)

**Left column — Profile card:**
- Company icon (Building2 from lucide, no avatar since companies don't have avatarUrl)
- Company name (h2)
- Domain (if present, as muted subtitle — clickable link)
- Badges: industry (outline badge), size (secondary badge)
- Separator
- Contact info section:
  - Website URL (Globe icon + link)
  - LinkedIn URL (Linkedin icon + link)
- Separator
- Owner section (same as contact detail: Avatar + name)
- Separator
- Custom fields: `<CustomFieldsDisplay entityId={id} entityType="company" />`

**Left column — Stats card:**
- "Related Entities" card
- Linked contacts count (from `contactCount` in `getCompany` response) — or defer to 7c
- Linked deals count — derived from deals tab data
- Created date (formatted)

**Right column — Tabs:**
- **Timeline tab:** `<ActivityTimeline companyId={id} />`
- **Deals tab:** Table of deals where `companyId` matches. Use `useDeals({ companyId: id })` or fetch via a dedicated query. Show: title (linked to `/deals/${deal.id}`), stage, value, priority, expected close date. "Add Deal" button opens DealForm with companyId pre-filled (if DealForm supports `defaultCompanyId` — check, may need to add).
- **Contacts tab:** Placeholder for now — will be filled by 7c (contact-company linking). Show: "Linked contacts will appear here." or render the linked contacts if 7c is done.

**Top bar:**
- Back button: `<- Companies` linking to `/companies`
- Edit button: Opens `EditCompanyDialog`
- Delete button: Confirmation dialog, calls `useDeleteCompany()`, redirects to `/companies` on success

**Delete flow:**
```ts
function handleDelete() {
  if (!confirm(`Delete "${company.name}"? This will unlink all contacts and cannot be undone.`)) return;
  deleteCompany.mutate(company.id, {
    onSuccess: () => {
      toast.success("Company deleted");
      router.push("/companies");
    },
    onError: () => toast.error("Failed to delete company"),
  });
}
```
Use `useRouter` from `next/navigation` for redirect.

**Loading state:** Skeleton layout matching the grid (same as contact detail).

**Not found state:** "Company not found" with back button (same as contact detail).

### Step 5: Company deals tab component
**File:** `src/components/companies/company-deals-tab.tsx` (new)

Very similar to `src/components/contacts/contact-deals-tab.tsx`:
1. Accepts `companyId: string` prop
2. Calls `useDeals({ companyId })` — after Step 3 extension
3. Renders table: Title (linked), Stage (badge), Value, Priority, Expected Close Date
4. "Add Deal" button opens DealForm. Need to check if DealForm supports `defaultCompanyId` — if not, this button can just open the form without pre-fill and the user picks the company via CompanyPicker (which will already show this company).
5. Empty state: "No deals for this company."
6. Loading skeleton rows

### Step 6: Verify DealForm companyId pre-fill
**File:** `src/components/pipeline/deal-form.tsx` (check/edit)

Check if `DealForm` accepts a `defaultCompanyId` prop. If not, add it:
1. Add `defaultCompanyId?: string` to the component props
2. Initialize the form's `companyId` field to `defaultCompanyId` when present
3. Pass this from `CompanyDealsTab` when opening the form

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| COMP-03 | View company detail page with profile card, related contacts, related deals, activity timeline, custom fields | Step 4 (page), Step 5 (deals tab), Steps 1-3 (extensions) |
| COMP-04 | Edit a company's details | Step 4 (edit button) — uses EditCompanyDialog from 7a |
| COMP-05 | Delete a company | Step 4 (delete button with confirmation + redirect) |

---

## Risks & Decisions

### ActivityTimeline / CustomFieldsDisplay / Deals may need extensions
These are investigation-dependent. If the existing components already support the needed props, Steps 1-3 are no-ops. If not, they're small additions (adding a filter param through the stack). The pattern is well-established from the contact side.

### DealForm companyId pre-fill
The DealForm may or may not have `defaultCompanyId`. If it does (because deal form has a CompanyPicker field), great. If not, adding it is trivial — one prop + one line of state init.

### Contacts tab placeholder
The Contacts section on the company detail page (COMP-03: "related contacts") is fully implemented in Phase 7c (contact-company linking). In this plan, we add a placeholder tab or section that says "Linked contacts will appear here" or, if 7b and 7c are implemented in rapid succession, the tab renders the linked contacts component from 7c. **Decision:** Create the tab structure with a placeholder. 7c will fill it in.

### Delete confirmation message
The delete confirmation mentions unlinking contacts. This is accurate because `contact_companies` has `onDelete: "cascade"` on `companyId`, so deleting a company removes all link records.

---

## Verification

After implementation:
1. `npm run build` passes
2. Navigate to `/companies/[id]` — profile card shows company info
3. Company name, domain, industry, size, URLs, owner all display correctly
4. Edit button opens EditCompanyDialog, changes save and reflect
5. Delete button shows confirmation, deletes company, redirects to `/companies`
6. Timeline tab shows activities (if any exist with this companyId)
7. Deals tab shows deals with this companyId
8. Custom fields display for entity type "company" (if any defined in settings)
9. Back button navigates to `/companies`
10. Loading skeleton displays while data fetches
11. "Company not found" shows for invalid IDs
