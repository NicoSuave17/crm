# Summary: 01-user-picker (UserPicker Shared Component)

## Status: Complete

## What was built
A reusable `UserPicker` component at `src/components/pickers/user-picker.tsx` using the shadcn/ui Popover + Command combobox pattern. This component provides a searchable dropdown of active team members with avatars, returning the selected user's ID.

## Files created
- `src/components/pickers/user-picker.tsx` — The UserPicker component (new file, new `pickers/` directory)

## Implementation details

### Props interface (`UserPickerProps`)
- `value?: string | null` — Currently selected user ID
- `onChange: (userId: string | null) => void` — Callback when user is selected/cleared
- `placeholder?: string` — Custom placeholder text (default: "Select user...")
- `disabled?: boolean` — Disable the picker
- `className?: string` — Additional CSS classes on the trigger button

### Key behaviors
1. **Active-only filtering:** Fetches all users via `useUsers()` hook, then filters to `isActive === true`. Deactivated users never appear in the dropdown.
2. **Search by name or email:** Each `CommandItem` value is set to `firstName + lastName + email`, enabling the Command component's built-in filtering to match on any of those fields.
3. **Avatar with fallback:** Each option renders an Avatar with image (from `avatarUrl`) and initials fallback (`firstName[0] + lastName[0]`).
4. **Toggle selection:** Clicking the same user again clears the selection (calls `onChange(null)`).
5. **Clear option:** When a user is selected, a "Clear selection" option with an X icon appears at the top of the list, separated by a `CommandSeparator`.
6. **Unknown user fallback:** If `value` is set but the user isn't found in the fetched list (e.g., deactivated after assignment), the trigger shows "Unknown user" instead of breaking.
7. **Selected user display:** When a user is selected, the trigger button shows their avatar (h-5 w-5) and full name.

### Dependencies used
- `useUsers` from `@/lib/hooks/use-users` (Wave 1)
- shadcn/ui: Popover, Command, Button, Avatar
- lucide-react: Check, ChevronsUpDown, X

## Commits
1. `feat(01-user-picker): task 1 - create user-picker.tsx file with use client directive`
2. `feat(01-user-picker): task 2 - define UserPickerProps interface`
3. `feat(01-user-picker): task 3 - implement Popover + Command component structure`
4. `feat(01-user-picker): task 4 - fetch and filter active users with useUsers hook`
5. `feat(01-user-picker): task 5 - render user options with avatar, check icon, and name`
6. `feat(01-user-picker): task 6 - display selected user in trigger with avatar and fallback`
7. `feat(01-user-picker): task 7 - add clear selection option with separator`

## Verification
- [x] TypeScript compiles with no errors (`tsc --noEmit` passes)
- [x] All 7 tasks implemented and committed atomically
- [x] Only active users shown (deactivated filtered out)
- [x] Searchable by name and email
- [x] Avatar with fallback initials for each option
- [x] Returns user UUID via onChange callback
- [x] Accepts value prop for pre-selection (edit mode)
- [x] Popover + Command pattern matches shadcn/ui conventions
