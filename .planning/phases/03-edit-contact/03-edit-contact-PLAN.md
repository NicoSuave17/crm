---
phase: 3
plan: "03-edit-contact"
title: "Edit Contact Dialog"
wave: 1
depends_on: []
files_modified:
  - src/lib/validators/contact.ts
  - src/components/contacts/edit-contact-dialog.tsx
  - src/app/(dashboard)/contacts/[id]/page.tsx
  - src/app/(dashboard)/contacts/page.tsx
autonomous: true
requirements:
  - CONT-01
  - CONT-02
  - CONT-03
  - CONT-04
  - CONT-05
---

# Edit Contact Dialog

## Objective
Build a reusable `EditContactDialog` component that pre-fills all contact fields and submits via PATCH, then wire it into both the contact detail page ("Edit" button) and the contacts list page (row dropdown "Edit" item).

## Context — What already exists

**Backend (fully built, no changes needed):**
- `PATCH /api/contacts/[id]` — validates with `updateContactSchema`, calls `updateContact()`, returns updated contact. Returns 400 with `details` (Zod flatten) on validation failure.
- `updateContact()` in `src/lib/api/contacts.ts` — Drizzle `.update()` with `updatedAt` auto-set.
- `useUpdateContact()` hook in `src/lib/hooks/use-contacts.ts` — `useMutation` that invalidates both `["contacts"]` and `["contacts", id]` query keys on success.
- `useContact(id)` hook — `useQuery` returning full contact with owner and tags.

**Frontend patterns to reuse:**
- `ContactForm` (`src/components/contacts/contact-form.tsx`) — create-only dialog. **Do NOT modify this file.** The edit dialog is a separate component because the field set differs (edit exposes healthScore, whopUsername, status, tier which create does not).
- `UserPicker` at `src/components/pickers/user-picker.tsx` — Popover+Command combobox, accepts `value` + `onChange`. Use for ownerId field.

**Validator gap:**
- `updateContactSchema` is `createContactSchema.partial()`. The create schema is missing `healthScore` and `whopUsername`. These must be added to the *update* schema (not the create schema) so the edit form can submit them.

## Pre-flight checks
Before writing any code, read these files to confirm assumptions:
1. `src/lib/validators/contact.ts` — confirm `updateContactSchema` shape
2. `src/lib/hooks/use-contacts.ts` — confirm `useUpdateContact` signature
3. `src/app/api/contacts/[id]/route.ts` — confirm PATCH returns Zod flatten on 400
4. `src/components/contacts/contact-form.tsx` — understand create form layout to keep edit form visually consistent
5. `src/components/pickers/user-picker.tsx` — confirm `UserPickerProps` interface

<tasks>

<task id="1">
**Extend the update validator to include healthScore and whopUsername.**

In `src/lib/validators/contact.ts`, change `updateContactSchema` from a simple `.partial()` of `createContactSchema` to a merge that adds the two missing fields:

```ts
export const updateContactSchema = createContactSchema.partial().extend({
  healthScore: z.number().int().min(0).max(100).optional().nullable(),
  whopUsername: z.string().optional().nullable(),
});
```

Update the `UpdateContactInput` type export accordingly (it already infers from `updateContactSchema` so no extra change needed there).

Do NOT touch `createContactSchema` — create does not need these fields.

After this change, verify no TypeScript errors in `src/app/api/contacts/[id]/route.ts` or `src/lib/api/contacts.ts`.
</task>

<task id="2">
**Create the `EditContactDialog` component.**

Create `src/components/contacts/edit-contact-dialog.tsx`. This is the core deliverable.

**Props interface:**
```ts
interface EditContactDialogProps {
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    type: string;
    status: string;
    tier: string | null;
    ownerId: string | null;
    healthScore: number | null;
    whopUsername: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Behavior:**
1. On open (or when `contact` prop changes), initialize local form state from `contact` prop values. This satisfies CONT-03 (pre-fill).
2. The form exposes ALL of these fields (CONT-04):
   - `firstName` — text input, required
   - `lastName` — text input
   - `email` — email input
   - `phone` — text input
   - `status` — Select with options: active, churned, at_risk, prospect, closed_lost
   - `tier` — Select with options: enterprise, premium, standard, starter (plus a "None" option that sends `undefined`)
   - `twitterUrl` — text input, placeholder "https://twitter.com/..."
   - `websiteUrl` — text input, placeholder "https://..."
   - `ownerId` — `UserPicker` component (import from `@/components/pickers/user-picker`)
   - `healthScore` — number input, min=0 max=100, placeholder "0-100"
   - `whopUsername` — text input, placeholder "username"
3. On submit, call `useUpdateContact().mutate({ id: contact.id, data })`.
4. On success: close dialog via `onOpenChange(false)`, show `toast.success("Contact updated")`.
5. On error: show `toast.error(error.message)`. Do NOT close the dialog (CONT-05 validation requirement).
6. Validation errors from the API (400 response) should be caught. The `useUpdateContact` hook throws with the error message from the API. For inline field errors, parse the API response. However, since the existing hook only throws `new Error(error.error || ...)`, for MVP surface the error via toast. The dialog stays open so the user can correct and retry. This satisfies the spirit of "validation errors surface without closing the dialog."

**Layout guidance** (match ContactForm visual style):
- Dialog max width: `sm:max-w-lg`
- Use 2-column grid for name fields (firstName + lastName), status + tier, healthScore + whopUsername
- Single column for email, phone, twitterUrl, websiteUrl, ownerId
- DialogFooter with Cancel + "Save Changes" button (disabled while `isPending`)
- Button text changes to "Saving..." while pending

**Imports:**
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`
- `Button` from `@/components/ui/button`
- `Input` from `@/components/ui/input`
- `Label` from `@/components/ui/label`
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`
- `UserPicker` from `@/components/pickers/user-picker`
- `useUpdateContact` from `@/lib/hooks/use-contacts`
- `toast` from `sonner`
- `useState, useEffect` from `react`
- `UpdateContactInput` type from `@/lib/validators/contact`

**Key implementation detail:** Use `useEffect` to reset form state whenever `contact` or `open` changes, so re-opening for a different contact always shows fresh data:
```ts
useEffect(() => {
  if (open) {
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      status: contact.status,
      tier: contact.tier ?? undefined,
      twitterUrl: contact.twitterUrl ?? "",
      websiteUrl: contact.websiteUrl ?? "",
      ownerId: contact.ownerId ?? undefined,
      healthScore: contact.healthScore ?? undefined,
      whopUsername: contact.whopUsername ?? "",
    });
  }
}, [contact, open]);
```

When building the `data` object for the mutation, convert empty strings to `undefined` (or `null` for nullable fields like ownerId) so the PATCH doesn't overwrite real values with empty strings. For healthScore, convert the string from the input to a number (or `null` if empty).
</task>

<task id="3">
**Wire the Edit button into the contact detail page.**

Modify `src/app/(dashboard)/contacts/[id]/page.tsx`:

1. Add imports: `EditContactDialog` from `@/components/contacts/edit-contact-dialog`, `Pencil` from `lucide-react`.
2. Add state: `const [editOpen, setEditOpen] = useState(false)`. Add `useState` to the existing `use` import from react.
3. In the header area (the `<div className="flex items-center gap-4">` that contains the back button), add an "Edit" button on the right side. Change this div to use `justify-between` so the back button is left and Edit is right:

```tsx
<div className="flex items-center justify-between">
  <Button asChild variant="ghost" size="sm">
    <Link href="/contacts">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Contacts
    </Link>
  </Button>
  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
    <Pencil className="mr-2 h-4 w-4" />
    Edit
  </Button>
</div>
```

4. Render `<EditContactDialog>` at the bottom of the component (after the grid), passing `contact={contact}`, `open={editOpen}`, `onOpenChange={setEditOpen}`. Only render when `contact` is truthy (it already is at that point in the component tree since we return early on loading/not-found).

This satisfies CONT-01.
</task>

<task id="4">
**Wire the Edit option into the contacts list row dropdown.**

Modify `src/app/(dashboard)/contacts/page.tsx`:

1. Add imports: `EditContactDialog` from `@/components/contacts/edit-contact-dialog`, `Pencil` from `lucide-react`.
2. Add state for tracking which contact is being edited:
```ts
const [editingContact, setEditingContact] = useState<{
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  type: string;
  status: string;
  tier: string | null;
  ownerId: string | null;
  healthScore: number | null;
  whopUsername: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
} | null>(null);
```

3. The contacts list `data.data` from the API does NOT include all fields needed for the edit form (it's a select projection missing phone, tier, whopUsername, twitterUrl, websiteUrl). Two options:
   - **Option A (recommended):** When the user clicks "Edit" in the dropdown, fetch the full contact via `GET /api/contacts/[id]` (the detail endpoint returns all fields) and then open the dialog. Use a small helper or inline fetch.
   - **Option B:** Add the missing fields to `listContacts()` select projection.

   Go with **Option A** to avoid changing the list query shape and keeping the list payload lean. Implementation:

   Add a helper function:
   ```ts
   async function handleEdit(contactId: string) {
     try {
       const res = await fetch(`/api/contacts/${contactId}`);
       if (!res.ok) throw new Error("Failed to fetch contact");
       const contact = await res.json();
       setEditingContact(contact);
     } catch {
       toast.error("Failed to load contact for editing");
     }
   }
   ```

4. In the `DropdownMenuContent` for each row, add an "Edit" item BEFORE the "Delete" item:
```tsx
<DropdownMenuItem onClick={() => handleEdit(contact.id)}>
  <Pencil className="mr-2 h-4 w-4" />
  Edit
</DropdownMenuItem>
```

5. Render the `EditContactDialog` once at the bottom of the page (outside the table), controlled by `editingContact`:
```tsx
{editingContact && (
  <EditContactDialog
    contact={editingContact}
    open={!!editingContact}
    onOpenChange={(open) => {
      if (!open) setEditingContact(null);
    }}
  />
)}
```

This satisfies CONT-02.
</task>

</tasks>

## Verification
- [ ] `updateContactSchema` accepts `healthScore` (number 0-100) and `whopUsername` (string) — no TypeScript errors in API route or data access layer
- [ ] `EditContactDialog` renders with all fields pre-filled from the `contact` prop (CONT-03)
- [ ] All required fields are present: firstName, lastName, email, phone, status, tier, twitterUrl, websiteUrl, ownerId (UserPicker), healthScore, whopUsername (CONT-04)
- [ ] Submitting the form sends a PATCH request to `/api/contacts/[id]` (CONT-05)
- [ ] On success: dialog closes, toast shows "Contact updated", list/detail page reflects new values (React Query invalidation from existing hook)
- [ ] On validation error: toast shows error message, dialog stays open for correction
- [ ] "Edit" button on contact detail page opens the dialog (CONT-01)
- [ ] "Edit" option in contacts list row dropdown opens the dialog (CONT-02)
- [ ] UserPicker shows current owner selection when contact has an ownerId
- [ ] healthScore input accepts only numbers 0-100
- [ ] Empty optional fields (email, phone, URLs) are sent as undefined/null, not empty strings
- [ ] `npm run build` passes with no errors

## must_haves
- Edit dialog is a separate component from ContactForm — create and edit have different field sets (CONT-04 vs create form)
- Pre-fills ALL current contact values on open (CONT-03)
- Exposes all 11 fields listed in CONT-04: firstName, lastName, email, phone, status, tier, twitterUrl, websiteUrl, ownerId, healthScore, whopUsername
- Uses existing PATCH API — no new API routes needed (CONT-05)
- Uses existing `useUpdateContact` hook — no new hooks needed
- Uses `UserPicker` for ownerId field — leverages Phase 2 deliverable
- Dialog stays open on validation error so user can correct and retry
- React Query invalidation on success is already handled by `useUpdateContact` hook
- Validator extended for healthScore and whopUsername without breaking create flow

## PLANNING COMPLETE
