# Summary: 03-edit-contact (Edit Contact Dialog)

## What was built
A reusable `EditContactDialog` component that pre-fills all contact fields and submits via PATCH, wired into both the contact detail page and the contacts list page.

## Tasks completed

### Task 1: Extend updateContactSchema
- Extended `updateContactSchema` in `src/lib/validators/contact.ts` to include `healthScore` (number 0-100, optional, nullable) and `whopUsername` (string, optional, nullable)
- `createContactSchema` left unchanged

### Task 2: Create EditContactDialog component
- Created `src/components/contacts/edit-contact-dialog.tsx`
- All 11 fields exposed: firstName, lastName, email, phone, status, tier, twitterUrl, websiteUrl, ownerId (UserPicker), healthScore, whopUsername
- Pre-fills all fields from contact prop on open (useEffect resets on contact/open change)
- Uses existing `useUpdateContact` hook for PATCH submission
- Toast success on save, toast error on failure (dialog stays open for retry)
- 2-column grid layout matching ContactForm visual style
- Empty optional fields converted to undefined/null before submission

### Task 3: Wire Edit button into contact detail page
- Modified `src/app/(dashboard)/contacts/[id]/page.tsx`
- Added Edit button with Pencil icon in header bar (right side, opposite back button)
- Renders EditContactDialog controlled by `editOpen` state

### Task 4: Wire Edit option into contacts list row dropdown
- Modified `src/app/(dashboard)/contacts/page.tsx`
- Added Edit dropdown item with Pencil icon before Delete item
- Fetches full contact via GET /api/contacts/[id] before opening dialog (list data lacks some fields)
- Renders EditContactDialog controlled by `editingContact` state

## Files modified
- `src/lib/validators/contact.ts` — extended updateContactSchema
- `src/components/contacts/edit-contact-dialog.tsx` — NEW component
- `src/app/(dashboard)/contacts/[id]/page.tsx` — Edit button + dialog
- `src/app/(dashboard)/contacts/page.tsx` — Edit dropdown item + dialog

## Verification
- TypeScript: no errors (`tsc --noEmit`)
- Build: passes (`npm run build`)
- All CONT-01 through CONT-05 requirements satisfied
