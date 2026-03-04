---
phase: 2
plan: "02-contact-picker"
title: "Contact Picker Component"
wave: 1
depends_on: []
files_modified:
  - src/components/pickers/contact-picker.tsx
autonomous: true
requirements:
  - PICK-01
  - PICK-05
---

# Contact Picker Component

## Objective
Deliver a reusable `ContactPicker` combobox that searches contacts by name/email and displays avatar + type badge, following the exact same Popover+Command pattern as the existing `UserPicker`.

<tasks>

<task id="1">
Create `src/components/pickers/contact-picker.tsx` following the exact pattern of `src/components/pickers/user-picker.tsx`. The component must:

**Props interface** — export `ContactPickerProps`:
```ts
export interface ContactPickerProps {
  value?: string | null;
  onChange: (contactId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Data fetching** — use the existing `useContacts` hook from `@/lib/hooks/use-contacts`. Call it with `{ limit: 100 }` so the picker has a reasonable pool to search from client-side. The hook returns `{ data: { data: Contact[], pagination }, isLoading }`. Destructure `result.data?.data ?? []` into a local `contacts` array typed as:
```ts
Array<{
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  type: "creator" | "lead" | "enterprise_prospect" | "partner";
}>
```

**Selected contact display** — when `value` is set, find the matching contact from the fetched list. If found, render in the trigger button: `Avatar` (with initials fallback from first/last name), full name, and a `Badge` showing the contact `type`. If `value` is set but contact not found in list, show "Unknown contact" in muted text (same pattern as UserPicker's "Unknown user").

**Command list items** — each `CommandItem` must:
- Set `value` to `${contact.firstName} ${contact.lastName ?? ""} ${contact.email ?? ""}` for search filtering
- Show a `Check` icon (opacity toggled by selection state)
- Show `Avatar` (h-6 w-6) with image or initials fallback
- Show full name as primary text
- Show a `Badge variant="outline"` with the contact `type` value (e.g. "creator", "lead")

**Clear selection** — when `value` is truthy, show a "Clear selection" `CommandItem` at the top (above `CommandSeparator`), same as UserPicker.

**Popover behavior** — `PopoverContent` width `w-[350px]` (wider than UserPicker to accommodate badge). `CommandInput` placeholder: "Search contacts...". `CommandEmpty` text: "No contact found."

**Imports** — use `Badge` from `@/components/ui/badge`. All other imports match UserPicker exactly: `Check`, `ChevronsUpDown`, `X` from lucide-react; `cn` from `@/lib/utils`; Popover, Command, Button, Avatar from `@/components/ui/*`.
</task>

</tasks>

## Verification
- [ ] `ContactPicker` renders with placeholder text when no value is set
- [ ] Typing in the search input filters contacts by name and email in real time
- [ ] Each item shows avatar, full name, and type badge
- [ ] Selecting a contact closes the popover and calls `onChange` with the contact's UUID
- [ ] Passing a `value` prop shows the selected contact's avatar, name, and badge in the trigger
- [ ] Clear selection button appears when a value is set and resets to null
- [ ] Component compiles with no TypeScript errors

## must_haves
- Searchable by both name and email (PICK-01)
- Avatar with initials fallback displayed per item (PICK-01)
- Type badge visible on each item and on selected display (PICK-01)
- Uses Popover + Command combobox pattern (PICK-05)
- Accepts `value` prop for edit-mode pre-selection (Success Criteria 5)
- Returns contact UUID via `onChange` callback (PICK-01)
