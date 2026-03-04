---
phase: 2
plan: "02-deal-picker"
title: "Deal Picker Component"
wave: 1
depends_on: []
files_modified:
  - src/components/pickers/deal-picker.tsx
autonomous: true
requirements:
  - PICK-04
  - PICK-05
---

# Deal Picker Component

## Objective
Deliver a reusable `DealPicker` combobox that searches deals by title, using the existing deals API and hook.

<tasks>

<task id="1">
Create `src/components/pickers/deal-picker.tsx` following the exact pattern of `src/components/pickers/user-picker.tsx`. The component must:

**Props interface** — export `DealPickerProps`:
```ts
export interface DealPickerProps {
  value?: string | null;
  onChange: (dealId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Data fetching** — use the existing `useDeals` hook from `@/lib/hooks/use-deals`. The hook returns `{ data: Deal[] }` (the GET /api/deals route returns a flat array). Destructure into a local typed array:
```ts
const allDeals = (data ?? []) as Array<{
  id: string;
  title: string;
  stageName: string;
  stageColor: string | null;
  value: string | null;
  pipelineName: string;
}>;
```

**Selected deal display** — when `value` is set, find matching deal. Show `Handshake` icon (from lucide-react, h-4 w-4) + deal title. If not found but value is truthy, show "Unknown deal" in muted text.

**Command list items** — each `CommandItem`:
- Set `value` to `${deal.title}` for search filtering by title
- Show `Check` icon (opacity toggled by selection state)
- Show `Handshake` icon (h-5 w-5, text-muted-foreground)
- Show deal title as primary text (`text-sm`)
- Show stage name in a small colored dot + text: render a `span` with `className="inline-block h-2 w-2 rounded-full mr-1"` using `style={{ backgroundColor: deal.stageColor ?? "#6B7280" }}` followed by `deal.stageName` in `text-xs text-muted-foreground`

**Clear selection** — same pattern as UserPicker: when value is truthy, show "Clear selection" CommandItem with X icon above CommandSeparator.

**Popover** — width `w-[350px]`. `CommandInput` placeholder: "Search deals...". `CommandEmpty`: "No deal found."

**Imports** — `Handshake` from lucide-react (plus Check, ChevronsUpDown, X). No Avatar or Badge needed. Otherwise match UserPicker imports for Popover, Command, Button, cn.
</task>

</tasks>

## Verification
- [ ] `DealPicker` renders with placeholder text when no value is set
- [ ] Typing in the search input filters deals by title in real time
- [ ] Each item shows deal icon, title, and stage indicator
- [ ] Selecting a deal closes the popover and calls `onChange` with the deal's UUID
- [ ] Passing a `value` prop shows the selected deal title in the trigger
- [ ] Clear selection button appears when a value is set and resets to null
- [ ] Component compiles with no TypeScript errors

## must_haves
- Searchable by deal title (PICK-04)
- Uses Popover + Command combobox pattern (PICK-05)
- Accepts `value` prop for edit-mode pre-selection (Success Criteria 5)
- Returns deal UUID via `onChange` callback (PICK-04)
- Shows stage context on each item for disambiguation when multiple deals have similar titles
