---
phase: 2
plan: "02-deal-picker"
title: "Deal Picker Component"
status: complete
completed: "2026-03-04"
---

# Summary: Deal Picker Component

## What was built
Reusable `DealPicker` combobox component at `src/components/pickers/deal-picker.tsx` following the exact UserPicker pattern.

## Tasks completed

### Task 1: Create DealPicker component
- Exported `DealPickerProps` interface with `value`, `onChange`, `placeholder`, `disabled`, `className`
- Uses existing `useDeals` hook from `@/lib/hooks/use-deals` for data fetching
- Popover + Command combobox with `w-[350px]` width
- Selected deal display: Handshake icon + deal title; "Unknown deal" fallback
- Command items: Check icon (selection state), Handshake icon, deal title, stage color dot + stage name
- Clear selection support with X icon + CommandSeparator
- Searchable by deal title via `CommandInput`

## Files created
- `src/components/pickers/deal-picker.tsx` — DealPicker component (124 lines)

## Files modified
None.

## Verification
- [x] TypeScript compiles with no errors (`tsc --noEmit` clean)
- [x] Follows UserPicker pattern exactly
- [x] Uses existing `useDeals` hook and `/api/deals` endpoint
- [x] Stage context (color dot + name) shown for disambiguation
- [x] Clear selection support when value is set

## Requirements covered
- PICK-04: Searchable by deal title, returns deal UUID via onChange
- PICK-05: Uses Popover + Command combobox pattern
- Success Criteria 5: Accepts value prop for edit-mode pre-selection
