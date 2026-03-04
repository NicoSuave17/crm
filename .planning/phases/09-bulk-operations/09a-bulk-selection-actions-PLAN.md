# Phase 9a: Bulk Selection + Actions

**Requirements:** BULK-01, BULK-02, BULK-03, BULK-04
**Scope:** Add row selection checkboxes to contacts and deals list pages, a floating bulk action bar that appears when rows are selected, and wire up bulk API endpoints for reassign, change status, add tag, delete (contacts) and move to stage (deals).
**Wave:** 1 (no dependencies outside existing codebase)
**Depends on:** None (existing bulk API route at `/api/bulk/route.ts` already handles `reassign_contacts` and `bulk_stage_change`)

---

## Current State Assessment

### What exists:
- **Contacts list** (`src/app/(dashboard)/contacts/page.tsx`) — Full paginated table with search, type/status filters, saved views, export CSV. No selection checkboxes.
- **Deals list** (`src/app/(dashboard)/deals/page.tsx`) — Full table with dropdown actions. No selection checkboxes.
- **Bulk API** (`src/app/api/bulk/route.ts`) — Already handles:
  - `PATCH` with `action: "reassign_contacts"` — bulk reassign contacts via `inArray`
  - `PATCH` with `action: "bulk_stage_change"` — bulk move deals to a stage via `inArray`
  - `PATCH` with `action: "import_contacts"` — CSV import (used by Plan 09b)
  - `GET` with `entityType=contact` — CSV export
  - All bulk actions log to audit log via `logAuditEvent`
- **Checkbox component** (`src/components/ui/checkbox.tsx`) — shadcn/ui checkbox, already installed.
- **UserPicker** (`src/components/pickers/user-picker.tsx`) — Reusable for bulk reassign target selection.
- **Tags hooks** (`src/lib/hooks/use-tags.ts`) — `useTags()`, `useAddTagToContact()`, `useAddTagToDeal()` already exist.
- **Pipeline hooks** (`src/lib/hooks/use-pipeline.ts`) — `usePipelines()` returns pipelines with stages, needed for "Move to stage" picker.

### What needs to be built:
1. Reusable `useRowSelection` hook for managing selected row IDs
2. Bulk action bar component (floating bar at bottom of screen)
3. Checkbox column in contacts table + "select all" header checkbox
4. Checkbox column in deals table + "select all" header checkbox
5. New bulk API actions: `change_status_contacts`, `add_tag_contacts`, `delete_contacts`, `add_tag_deals`, `delete_deals`
6. React Query hooks for all bulk mutations

---

## Implementation Steps

### Step 1: Create `useRowSelection` hook
**File:** `src/lib/hooks/use-row-selection.ts` (new)

A generic hook for managing row selection state across any list page.

```ts
interface UseRowSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: (allIds: string[]) => void;
  clear: () => void;
  count: number;
  isAllSelected: (allIds: string[]) => boolean;
  isSomeSelected: (allIds: string[]) => boolean;
}
```

**Behavior:**
- `selectedIds` stored as `useState<Set<string>>(new Set())`
- `toggle(id)` — adds if not present, removes if present (new Set to trigger re-render)
- `toggleAll(allIds)` — if all are currently selected, deselect all; otherwise select all from the provided array
- `clear()` — empty the set
- `isAllSelected(allIds)` — true if every id in `allIds` is in `selectedIds` and `allIds.length > 0`
- `isSomeSelected(allIds)` — true if some but not all are selected (used for indeterminate checkbox state)

**Important edge case:** When the user changes page, search, or filters, selection should clear. The hook itself does not handle this — the consuming page is responsible for calling `clear()` in the same `useEffect` or callback that changes page/filters. This keeps the hook generic.

### Step 2: Create `useBulkActions` hook
**File:** `src/lib/hooks/use-bulk-actions.ts` (new)

React Query mutations for all bulk operations.

```ts
// Contacts
useBulkReassignContacts()   // existing API: action "reassign_contacts"
useBulkStatusContacts()     // new API: action "change_status_contacts"
useBulkTagContacts()        // new API: action "add_tag_contacts"
useBulkDeleteContacts()     // new API: action "delete_contacts"

// Deals
useBulkStageDeal()          // existing API: action "bulk_stage_change"
useBulkTagDeals()           // new API: action "add_tag_deals"
useBulkDeleteDeals()        // new API: action "delete_deals"
```

Each mutation:
- Calls `PATCH /api/bulk` with the appropriate action + entity IDs + payload
- On success: invalidates the relevant query key (`["contacts"]` or `["deals"]` + `["pipeline"]`)
- Returns the response (success count, etc.)

**Pattern for each:**
```ts
export function useBulkReassignContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { contactIds: string[]; newOwnerId: string }) => {
      const res = await fetch("/api/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign_contacts", ...data }),
      });
      if (!res.ok) throw new Error("Bulk reassign failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
```

### Step 3: Expand `/api/bulk` PATCH handler
**File:** `src/app/api/bulk/route.ts` (edit)

Add the missing bulk actions to the existing PATCH handler.

**New actions to add:**

**`change_status_contacts`:**
- Payload: `{ contactIds: string[], status: string }`
- SQL: `UPDATE contacts SET status = ?, updated_at = NOW() WHERE id IN (?)`
- Validate status is a valid `contactStatusEnum` value
- Audit log: `action: "bulk_status_change"` with metadata `{ contactIds, status, count }`

**`add_tag_contacts`:**
- Payload: `{ contactIds: string[], tagId: string }`
- SQL: For each contactId, INSERT INTO contact_tags (contact_id, tag_id) ON CONFLICT DO NOTHING
- Use `db.insert(contactTags).values(rows).onConflictDoNothing()` (Drizzle supports this)
- Audit log: `action: "bulk_add_tag"` with metadata `{ contactIds, tagId, count }`

**`delete_contacts`:**
- Payload: `{ contactIds: string[] }`
- SQL: `DELETE FROM contacts WHERE id IN (?)`
- Note: CASCADE will handle contact_tags, activities, tasks linked to these contacts
- Audit log: `action: "bulk_delete"` with metadata `{ entityType: "contact", contactIds, count }`

**`add_tag_deals`:**
- Payload: `{ dealIds: string[], tagId: string }`
- Same pattern as contacts but using `dealTags` table
- Audit log: `action: "bulk_add_tag"` with metadata `{ dealIds, tagId, count }`

**`delete_deals`:**
- Payload: `{ dealIds: string[] }`
- SQL: `DELETE FROM deals WHERE id IN (?)`
- Audit log: `action: "bulk_delete"` with metadata `{ entityType: "deal", dealIds, count }`

**Safety:** Add a maximum of 500 IDs per request. If `contactIds.length > 500` or `dealIds.length > 500`, return 400 with error "Too many items selected (max 500)".

### Step 4: Create BulkActionBar component
**File:** `src/components/bulk/bulk-action-bar.tsx` (new)

A floating bar that slides up from the bottom of the screen when rows are selected.

**Props:**
```ts
interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  children: React.ReactNode; // action buttons are passed as children for flexibility
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ✓ 12 selected    [Reassign] [Change Status] [Add Tag] [Delete]  ✕  │
└──────────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Fixed to bottom of viewport: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- Dark background with blur: `bg-background/95 backdrop-blur border shadow-lg rounded-lg`
- Flex row with items-center, gap-2, px-4 py-3
- Animate in/out: use `AnimatePresence` + `motion.div` from framer-motion if available, otherwise CSS transition with `translate-y-0` when visible and `translate-y-full` when hidden. Check if framer-motion is in package.json — if not, use pure CSS transitions via `data-visible` attribute + `transition-transform duration-200`.
- Minimum width to not look cramped: `min-w-[400px]`

**Left side:** Checkbox icon + "{count} selected" text
**Right side:** Action buttons (passed as `children`) + close button (X icon) that calls `onClear`

**Visibility:** Render conditionally or with CSS based on `selectedCount > 0`.

### Step 5: Create ContactsBulkActions component
**File:** `src/components/bulk/contacts-bulk-actions.tsx` (new)

The action buttons specific to contacts bulk operations. Rendered inside `BulkActionBar`.

**Props:**
```ts
interface ContactsBulkActionsProps {
  selectedIds: string[];
  onComplete: () => void; // called after any successful action to clear selection
}
```

**Actions:**

1. **Reassign** — Button that opens a Popover with `UserPicker`. On user selection, calls `useBulkReassignContacts().mutate({ contactIds, newOwnerId })`, toasts "Reassigned {count} contacts", calls `onComplete()`.

2. **Change Status** — Button that opens a Popover with a Select containing the 5 contact statuses (active, prospect, at_risk, churned, closed_lost). On selection, calls `useBulkStatusContacts().mutate({ contactIds, status })`, toasts "Updated status for {count} contacts", calls `onComplete()`.

3. **Add Tag** — Button that opens a Popover with a tag list (fetched via `useTags()`). Each tag rendered as a clickable row with color dot + name. On click, calls `useBulkTagContacts().mutate({ contactIds, tagId })`, toasts "Tag added to {count} contacts", calls `onComplete()`.

4. **Delete** — Destructive button. On click, opens an `AlertDialog` confirmation: "Delete {count} contacts? This action cannot be undone. All associated activities, tasks, and deals will be affected." On confirm, calls `useBulkDeleteContacts().mutate({ contactIds })`, toasts "Deleted {count} contacts", calls `onComplete()`.

**Each button:** Small variant, appropriate icon (UserPlus for reassign, ArrowUpDown for status, Tag for add tag, Trash2 for delete). Delete button uses destructive variant.

**Loading state:** While any mutation is pending, all buttons show disabled state. The active mutation button shows a spinner.

### Step 6: Create DealsBulkActions component
**File:** `src/components/bulk/deals-bulk-actions.tsx` (new)

Same pattern as contacts but with deals-specific actions.

**Props:**
```ts
interface DealsBulkActionsProps {
  selectedIds: string[];
  onComplete: () => void;
}
```

**Actions:**

1. **Move to Stage** — Button that opens a Popover showing pipelines > stages in a grouped list. Use `usePipelines()` to fetch all pipelines with stages. Render as:
   ```
   Pipeline: Sales
     ● Lead
     ● Qualified
     ● Demo
   Pipeline: Enterprise
     ● Discovery
     ● Proposal
   ```
   On stage click, calls `useBulkStageDeal().mutate({ dealIds, stageId })`, toasts "Moved {count} deals to {stageName}", calls `onComplete()`.

   **Note:** Bulk stage change bypasses individual deal stage history recording. This is acceptable for bulk operations — the audit log captures it. Document this as a known trade-off.

2. **Add Tag** — Same pattern as contacts but uses `useBulkTagDeals()`.

3. **Delete** — Same pattern as contacts but for deals. Confirmation: "Delete {count} deals? This cannot be undone."

### Step 7: Add checkboxes to contacts list page
**File:** `src/app/(dashboard)/contacts/page.tsx` (edit)

**Changes:**

1. **Import** `useRowSelection` hook, `BulkActionBar`, `ContactsBulkActions`, `Checkbox` from UI.

2. **Add state:** `const selection = useRowSelection();`

3. **Clear selection on filter/page change:** In the `onChange` callbacks for search, typeFilter, statusFilter, and page, add `selection.clear()`. Alternatively, create a derived `currentPageIds` array and use it.

4. **Compute `currentPageIds`:** After data loads:
   ```ts
   const currentPageIds = data?.data?.map((c) => c.id) ?? [];
   ```

5. **Add checkbox column to table header:**
   ```tsx
   <TableHead className="w-[40px]">
     <Checkbox
       checked={selection.isAllSelected(currentPageIds)}
       indeterminate={selection.isSomeSelected(currentPageIds)}
       onCheckedChange={() => selection.toggleAll(currentPageIds)}
       aria-label="Select all"
     />
   </TableHead>
   ```

   **Note on indeterminate:** shadcn Checkbox supports `checked="indeterminate"` state. The `isAllSelected` returns true, `isSomeSelected` returns true when partial. Map: if `isAllSelected` -> `checked={true}`, elif `isSomeSelected` -> `checked="indeterminate"`, else `checked={false}`.

6. **Add checkbox column to each row:**
   ```tsx
   <TableCell className="w-[40px]">
     <Checkbox
       checked={selection.isSelected(contact.id)}
       onCheckedChange={() => selection.toggle(contact.id)}
       aria-label={`Select ${contact.firstName}`}
     />
   </TableCell>
   ```

7. **Update colSpan** in the empty state row from 7 to 8.

8. **Add BulkActionBar at bottom** (inside the page div, after pagination):
   ```tsx
   {selection.count > 0 && (
     <BulkActionBar selectedCount={selection.count} onClear={selection.clear}>
       <ContactsBulkActions
         selectedIds={Array.from(selection.selectedIds)}
         onComplete={selection.clear}
       />
     </BulkActionBar>
   )}
   ```

### Step 8: Add checkboxes to deals list page
**File:** `src/app/(dashboard)/deals/page.tsx` (edit)

Same pattern as contacts:

1. **Import** `useRowSelection`, `BulkActionBar`, `DealsBulkActions`, `Checkbox`.

2. **Add state:** `const selection = useRowSelection();`

3. **Compute `currentPageIds`:**
   ```ts
   const currentPageIds = deals?.map((d) => d.id) ?? [];
   ```

4. **Add checkbox column to table header** (same pattern as contacts, first column).

5. **Add checkbox column to each deal row.**

6. **Update colSpan** in empty state row from 8 to 9.

7. **Add BulkActionBar** after the table:
   ```tsx
   {selection.count > 0 && (
     <BulkActionBar selectedCount={selection.count} onClear={selection.clear}>
       <DealsBulkActions
         selectedIds={Array.from(selection.selectedIds)}
         onComplete={selection.clear}
       />
     </BulkActionBar>
   )}
   ```

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| BULK-01 | Contacts list has row selection checkboxes | Step 7 (checkbox column + select-all header) |
| BULK-02 | Bulk action bar with Reassign, Change Status, Add Tag, Delete | Steps 4, 5, 7 (BulkActionBar + ContactsBulkActions) |
| BULK-03 | Deals list has row selection checkboxes | Step 8 (checkbox column + select-all header) |
| BULK-04 | Deals bulk action bar includes "Move to stage" | Steps 4, 6, 8 (BulkActionBar + DealsBulkActions with stage picker) |

---

## Risks & Decisions

### Selection scope: current page only vs. all pages
Selection checkboxes apply to the **current page** only. The "select all" checkbox toggles all rows visible on the current page (up to 25 contacts per page). Cross-page selection ("select all 1,234 contacts matching this filter") is a power-user feature that adds significant complexity (requires server-side selection tracking or passing filter criteria to bulk API). Not in scope for BULK-01..04 — can be added later as an enhancement if needed.

### Stage history for bulk stage changes
The existing `PATCH /api/bulk` handler for `bulk_stage_change` does a simple `UPDATE ... SET stageId WHERE id IN (...)`. This does NOT record individual `dealStageHistory` entries for each deal (unlike `moveDeal()` in `src/lib/api/deals.ts` which records history). For bulk operations with potentially hundreds of deals, recording individual stage history would require N inserts. Trade-off: the audit log captures the bulk action with all deal IDs. If individual stage history is needed in the future, the bulk endpoint can be enhanced to batch-insert history rows.

### Bulk delete safety
Bulk delete is destructive. The implementation requires an `AlertDialog` confirmation with explicit text about what will happen. There is no "undo" — this is consistent with the single-item delete behavior already in the codebase (which uses `confirm()` dialogs). The confirmation dialog for bulk delete is more prominent than the single-item `confirm()` to match the higher stakes.

### Max selection limit
The API enforces a 500-item limit per bulk operation. This prevents accidentally destructive operations on the entire database and keeps query performance reasonable. The UI does not enforce this (the user can select up to 25 per page, so hitting 500 would require selecting across 20 pages — unlikely but possible with future cross-page selection). If the API returns 400, the bulk action hook surfaces the error via toast.

### Popover vs. Dialog for action pickers
Reassign, Change Status, and Add Tag use Popovers (lightweight, inline). Delete uses AlertDialog (heavyweight, modal). This matches the interaction pattern: picking a value is a quick action (popover), confirming destruction is a deliberate action (dialog).

### Animation for bulk bar
If framer-motion is not in the project's dependencies, use CSS-only animation. Check `package.json` before implementing. Prefer not adding framer-motion just for this — CSS `transform` + `transition` is sufficient for a slide-up effect.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Contacts page
3. Each row has a checkbox on the left
4. Clicking a checkbox selects the row (visual highlight or checkbox state)
5. Clicking the header checkbox selects/deselects all visible rows
6. When rows are selected, bulk action bar appears at the bottom
7. Click "Reassign" — user picker popover opens, select a user, contacts are reassigned, selection clears, toast confirms
8. Click "Change Status" — status select popover opens, pick a status, contacts updated, toast confirms
9. Click "Add Tag" — tag list popover opens, pick a tag, tag added to all selected contacts, toast confirms
10. Click "Delete" — AlertDialog confirms, on confirm contacts deleted, toast confirms
11. Navigate to Deals page
12. Same checkbox behavior as contacts
13. Click "Move to Stage" — pipeline/stage picker opens, select a stage, deals moved, toast confirms
14. Changing search/filters/page clears the selection
15. Bulk bar disappears when selection is cleared
16. No console errors throughout all interactions
