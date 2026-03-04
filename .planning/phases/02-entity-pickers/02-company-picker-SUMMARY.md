---
phase: 2
plan: "02-company-picker"
title: "Company Picker Component"
status: complete
completed: "2026-03-04"
---

# Company Picker - Summary

## What was delivered
A reusable `CompanyPicker` combobox component with full backend plumbing (data access layer, API route, React Query hook).

## Files created

| File | Purpose |
|------|---------|
| `src/lib/api/companies.ts` | Data access layer - `listCompanies()` with search by name/domain |
| `src/app/api/companies/route.ts` | GET /api/companies endpoint, auth-protected via `requireUser()` |
| `src/lib/hooks/use-companies.ts` | `useCompanies()` React Query hook |
| `src/components/pickers/company-picker.tsx` | `CompanyPicker` combobox component |

## Key decisions
- Followed UserPicker pattern exactly for consistency
- Used `Building2` icon from lucide-react instead of Avatar (companies don't have avatars)
- Domain shown as secondary muted text in both trigger and list items
- CommandItem `value` includes both name and domain for search filtering
- Imported `and` from drizzle-orm in data access layer as required

## Verification
- [x] TypeScript compiles with no errors (`tsc --noEmit` passes)
- [x] `listCompanies` searches by name AND domain via `ilike`
- [x] API route is auth-protected with `requireUser()`
- [x] CompanyPicker accepts `value` prop for edit-mode pre-selection
- [x] Clear selection resets to null
- [x] Uses Popover + Command combobox pattern (PICK-05)
- [x] Returns company UUID via `onChange` callback (PICK-02)
