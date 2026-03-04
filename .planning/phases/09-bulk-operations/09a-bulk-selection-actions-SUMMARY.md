# Plan 09a: Bulk Selection + Actions - SUMMARY

**Status:** Complete
**Completed:** 2026-03-05

---

## What Was Built

### 1. `useRowSelection` hook (`src/lib/hooks/use-row-selection.ts`)
Generic row selection state management hook. Provides `selectedIds` (Set), `toggle`, `toggleAll`, `clear`, `isSelected`, `isAllSelected`, `isSomeSelected`, and `count`. Reusable across any list page.

### 2. `useBulkActions` hooks (`src/lib/hooks/use-bulk-actions.ts`)
React Query mutations for all 7 bulk operations:
- **Contacts:** `useBulkReassignContacts`, `useBulkStatusContacts`, `useBulkTagContacts`, `useBulkDeleteContacts`
- **Deals:** `useBulkStageDeal`, `useBulkTagDeals`, `useBulkDeleteDeals`

All call `PATCH /api/bulk` and invalidate relevant query keys on success.

### 3. Expanded `/api/bulk` PATCH handler (`src/app/api/bulk/route.ts`)
Added 5 new bulk actions with audit logging and 500-item safety limit:
- `change_status_contacts` - validates against contactStatusEnum
- `add_tag_contacts` - uses `onConflictDoNothing` for idempotent tag assignment
- `delete_contacts` - cascade handles related records
- `add_tag_deals` - same pattern as contacts
- `delete_deals` - cascade handles related records

### 4. `BulkActionBar` component (`src/components/bulk/bulk-action-bar.tsx`)
Floating bar fixed to bottom of viewport when rows are selected. Shows count, action buttons (via children), and clear button. CSS-only slide-in animation.

### 5. `ContactsBulkActions` component (`src/components/bulk/contacts-bulk-actions.tsx`)
Action buttons rendered inside BulkActionBar for contacts:
- **Reassign** - Popover with UserPicker
- **Change Status** - Popover with Select (5 contact statuses)
- **Add Tag** - Popover with scrollable tag list (color dots)
- **Delete** - AlertDialog confirmation with destructive styling

All buttons show loading spinners and disable during mutations.

### 6. `DealsBulkActions` component (`src/components/bulk/deals-bulk-actions.tsx`)
Action buttons for deals:
- **Move to Stage** - Popover with grouped pipeline > stage picker
- **Add Tag** - Same pattern as contacts
- **Delete** - AlertDialog confirmation

### 7. Contacts list page (`src/app/(dashboard)/contacts/page.tsx`)
- Checkbox column added as first column with select-all header
- Indeterminate state on header checkbox when partial selection
- Selection clears automatically on filter, search, or page change
- BulkActionBar appears when any rows are selected

### 8. Deals list page (`src/app/(dashboard)/deals/page.tsx`)
- Same checkbox pattern as contacts
- BulkActionBar with DealsBulkActions

---

## Requirement Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| BULK-01 | Contacts list row selection checkboxes | Done |
| BULK-02 | Bulk action bar (Reassign, Status, Tag, Delete) | Done |
| BULK-03 | Deals list row selection checkboxes | Done |
| BULK-04 | Deals bulk "Move to stage" action | Done |

---

## Design Decisions

- **Current page selection only** - Select-all applies to visible page (up to 25 items). Cross-page selection deferred as enhancement.
- **Bulk stage change skips individual stage history** - Audit log captures the bulk action with all deal IDs. Individual `dealStageHistory` entries not recorded for performance.
- **500-item API limit** - Safety guard against accidentally destructive operations.
- **CSS-only animation** - No framer-motion dependency added; uses Tailwind `animate-in slide-in-from-bottom-4`.
- **Popover for pickers, AlertDialog for delete** - Lightweight interactions for value selection, modal confirmation for destructive actions.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/hooks/use-row-selection.ts` | New - generic row selection hook |
| `src/lib/hooks/use-bulk-actions.ts` | New - 7 bulk mutation hooks |
| `src/app/api/bulk/route.ts` | Modified - 5 new actions + validation |
| `src/components/bulk/bulk-action-bar.tsx` | New - floating selection bar |
| `src/components/bulk/contacts-bulk-actions.tsx` | New - contacts action buttons |
| `src/components/bulk/deals-bulk-actions.tsx` | New - deals action buttons |
| `src/app/(dashboard)/contacts/page.tsx` | Modified - checkboxes + bulk bar |
| `src/app/(dashboard)/deals/page.tsx` | Modified - checkboxes + bulk bar |

---

## Verification

- `npm run build` passes with no errors
- All 8 implementation steps completed and committed atomically
