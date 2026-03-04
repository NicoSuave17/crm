---
phase: 1
plan: "01-user-picker"
title: "UserPicker Shared Component"
wave: 2
depends_on:
  - "01-users-api"
files_modified:
  - src/components/pickers/user-picker.tsx
autonomous: true
requirements:
  - USER-05
---

# UserPicker Shared Component

## Objective
Create a reusable `UserPicker` component using shadcn/ui's Popover + Command combobox pattern that shows a searchable dropdown of active team members with avatars, returning the selected user's ID.

<tasks>

<task id="1">
Create the file `src/components/pickers/user-picker.tsx` (creating the `pickers/` directory).

This component will be the foundation for all entity pickers in Phase 2 (PICK-03 reuses this exact component).

Mark the file with `"use client"` at the top.
</task>

<task id="2">
Define the component props interface:

```typescript
interface UserPickerProps {
  value?: string | null;           // Currently selected user ID
  onChange: (userId: string | null) => void;  // Callback when user is selected/cleared
  placeholder?: string;            // Custom placeholder text, default "Select user..."
  disabled?: boolean;              // Disable the picker
  className?: string;              // Additional CSS classes on the trigger button
}
```

Export `UserPickerProps` for reuse.
</task>

<task id="3">
Implement the component structure using Popover + Command from shadcn/ui:

```
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between", className)} disabled={disabled}>
      {selectedUser ? (avatar + name display) : placeholder}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[300px] p-0" align="start">
    <Command>
      <CommandInput placeholder="Search team members..." />
      <CommandEmpty>No team member found.</CommandEmpty>
      <CommandGroup>
        <CommandList>
          {filteredUsers.map(user => <CommandItem>...</CommandItem>)}
        </CommandList>
      </CommandGroup>
    </Command>
  </PopoverContent>
</Popover>
```

Imports needed:
- `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`
- `Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList` from `@/components/ui/command`
- `Button` from `@/components/ui/button`
- `Avatar, AvatarImage, AvatarFallback` from `@/components/ui/avatar`
- `Check, ChevronsUpDown` from `lucide-react`
- `cn` from `@/lib/utils`
- `useUsers` from `@/lib/hooks/use-users`
- `useState` from `react`
</task>

<task id="4">
Fetch and filter users inside the component:

- Call `useUsers()` to get all users.
- Filter the list to only `isActive === true` users. Deactivated team members must NOT appear in the picker (this satisfies success criteria #3 from the phase).
- The Command component's built-in search filters by the `value` prop on each `CommandItem`. Set each `CommandItem`'s `value` to `user.firstName + " " + user.lastName + " " + user.email` so searching by name OR email works.
</task>

<task id="5">
Render each user option as a `CommandItem`:

```tsx
<CommandItem
  key={user.id}
  value={`${user.firstName} ${user.lastName} ${user.email}`}
  onSelect={() => {
    onChange(user.id === value ? null : user.id);  // Toggle selection (clicking same user clears)
    setOpen(false);
  }}
>
  <Check className={cn("mr-2 h-4 w-4", value === user.id ? "opacity-100" : "opacity-0")} />
  <Avatar className="h-6 w-6 mr-2">
    <AvatarImage src={user.avatarUrl} alt={user.firstName} />
    <AvatarFallback className="text-xs">
      {user.firstName?.[0]}{user.lastName?.[0]}
    </AvatarFallback>
  </Avatar>
  <span className="text-sm">{user.firstName} {user.lastName}</span>
</CommandItem>
```
</task>

<task id="6">
Display the selected user in the trigger button:

When `value` is set, find the matching user from the fetched list and display:
- Their avatar (small, `h-5 w-5`)
- Their full name (`firstName + " " + lastName`)

When `value` is null/undefined, show the placeholder text.

Handle the edge case where `value` is set but the user is not found in the list (e.g., user was deactivated after being assigned). In this case, show "Unknown user" as fallback text.
</task>

<task id="7">
Add a "Clear" option at the top of the command list when a user is currently selected:

```tsx
{value && (
  <CommandItem onSelect={() => { onChange(null); setOpen(false); }}>
    <X className="mr-2 h-4 w-4" />
    <span className="text-muted-foreground">Clear selection</span>
  </CommandItem>
)}
```

Import `X` from `lucide-react`.

Add a `<CommandSeparator />` between the clear option and the user list.
</task>

</tasks>

## Verification
- [ ] `<UserPicker value={null} onChange={fn} />` renders a button with "Select user..." placeholder
- [ ] Clicking the button opens a popover with a search input and list of active users
- [ ] Each user option shows avatar (with fallback initials), and full name
- [ ] Typing in the search input filters users by name or email
- [ ] Selecting a user calls `onChange` with the user's UUID and closes the popover
- [ ] The trigger button updates to show the selected user's avatar and name
- [ ] Deactivated users do NOT appear in the dropdown
- [ ] Clicking the selected user again or the "Clear" option calls `onChange(null)`
- [ ] The `disabled` prop disables the trigger button
- [ ] The component works with `value` pre-set (edit mode)

## must_haves
- Only active users shown in the picker (deactivated users filtered out)
- Searchable by name and email
- Shows avatar with fallback initials for each option
- Returns user UUID via onChange callback
- Accepts value prop for pre-selection (needed by edit forms in later phases)
- Popover + Command pattern matching shadcn/ui conventions
