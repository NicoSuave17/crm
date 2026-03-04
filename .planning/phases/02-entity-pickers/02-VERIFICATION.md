---
phase: 2
status: human_needed
verified: 2026-03-04
score: 14/15
---

# Phase 2: Entity Pickers — Verification

## Requirement Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PICK-01 | Contact picker — searchable by name/email with avatar + type badge | PASS | `contact-picker.tsx` — CommandItem value includes `firstName lastName email`, Avatar with initials fallback, Badge variant="outline" on trigger and list items |
| PICK-02 | Company picker — searchable by name/domain | PASS | `company-picker.tsx` — CommandItem value is `${company.name} ${company.domain ?? ""}`, Building2 icon in place of avatar |
| PICK-03 | User picker — active team members with avatar + name | PASS | `user-picker.tsx` (Phase 1 deliverable, confirmed still present) — `activeUsers` filter on `isActive === true`, Avatar with initials fallback |
| PICK-04 | Deal picker — searchable by title | PASS | `deal-picker.tsx` — CommandItem value is `deal.title`, Handshake icon, stage color dot + stage name shown per item |
| PICK-05 | All pickers use Popover + Command combobox pattern | PASS | All four components import and compose `Popover/PopoverTrigger/PopoverContent` wrapping `Command/CommandInput/CommandList/CommandGroup/CommandItem` |

## Must-Have Checks

| Check | Status | Notes |
|-------|--------|-------|
| ContactPicker — search filters by name AND email | PASS | `CommandItem value={${firstName} ${lastName} ${email}}` at line 103 |
| ContactPicker — avatar with initials fallback displayed per item | PASS | `Avatar > AvatarImage + AvatarFallback` on trigger (line 63–67) and list item (line 115–120) |
| ContactPicker — type badge on each item and selected display | PASS | `Badge variant="outline"` on trigger (line 70) and item (line 122) |
| CompanyPicker — search by name AND domain | PASS | `listCompanies` uses `ilike` on both `companies.name` and `companies.domain`; CommandItem value includes both |
| CompanyPicker — API route auth-protected | PASS | `route.ts` calls `await requireUser()` before any data access |
| UserPicker — active-only filter | PASS | `activeUsers = allUsers.filter(u => u.isActive === true)` at line 49 |
| UserPicker — inactive user resolved for display | PASS | Selected user lookup uses `allUsers` (all users) not `activeUsers`, so a pre-selected inactive user still renders gracefully |
| DealPicker — stage context per item | PASS | Colored dot (`style={{ backgroundColor: deal.stageColor ?? "#6B7280" }}`) + `deal.stageName` in `text-xs text-muted-foreground` at lines 111–115 |
| All pickers — consistent props interface | PASS | All four export `{ value?: string | null; onChange: (id: string | null) => void; placeholder?: string; disabled?: boolean; className?: string }` |
| All pickers — clear selection affordance | PASS | All four render "Clear selection" CommandItem above CommandSeparator when `value` is truthy |
| All pickers — unknown entity fallback | PASS | All four show "Unknown X" in muted text when `value` is set but entity not found in data |
| TypeScript compilation | PASS | `tsc --noEmit` completes with zero errors |
| `use-companies.ts` hook wired to `/api/companies` | PASS | Fetches `/api/companies?limit=100` with React Query, queryKey `["companies"]` |
| No barrel index file (`pickers/index.ts`) | NOTE | No `index.ts` barrel exists; consumers must import from individual files. Not a requirement — all plans specify direct file paths. Not a defect. |

## Success Criteria

| Criteria | Status | Notes |
|----------|--------|-------|
| Four picker files exist under `src/components/pickers/` | PASS | `contact-picker.tsx`, `company-picker.tsx`, `user-picker.tsx`, `deal-picker.tsx` |
| All four implement identical props shape | PASS | `value`, `onChange`, `placeholder`, `disabled`, `className` — verified across all four |
| Company picker ships with backend plumbing | PASS | `src/lib/api/companies.ts`, `src/app/api/companies/route.ts`, `src/lib/hooks/use-companies.ts` all created |
| Pickers are importable by future phases | PASS | Components are exported named exports at predictable paths; TypeScript resolves with no errors |
| No runtime import failures | HUMAN NEEDED | Cannot verify without running browser; all imports resolve at type-check time |

## Code Quality

| Aspect | Assessment |
|--------|------------|
| Pattern consistency | Excellent — all four pickers share identical structural layout: `useState(open)` → `Popover` → `PopoverTrigger` as `Button` with `role="combobox"` → `PopoverContent` → `Command` subtree |
| Type safety | Good — all pickers cast fetched data to explicit inline types. No `any` usage. `value` and `onChange` are properly nullable. |
| UX completeness | Good — selected state display, clear selection, "unknown entity" fallback, disabled state, className forwarding all present |
| Data loading | Acceptable for a picker (client-side search on up to 100 records). No loading/error state is rendered in the trigger; the button will just appear empty while loading. This is standard combobox behavior and not a blocker. |
| `listCompanies` — `and` import | PASS — `and` is imported from `drizzle-orm` at line 3 of `src/lib/api/companies.ts` |

## Human Verification Items

The following cannot be confirmed by static analysis and require browser testing:

1. **ContactPicker** — Open popover on a page with real contact data; verify typing filters by email as well as name; verify avatar image loads or initials render correctly.
2. **CompanyPicker** — Verify `GET /api/companies` returns data against the live database; verify domain filter works.
3. **UserPicker** — Confirm deactivated users are hidden from the list but their names still resolve in the trigger if previously assigned.
4. **DealPicker** — Verify stage color dot renders with the correct color from the database; confirm `useDeals()` with no params returns all deals (not filtered to a pipeline).
5. **All pickers** — Verify `disabled` prop visually disables the trigger button; confirm popover does not open when disabled.

## Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No barrel `index.ts` in `src/components/pickers/` | Low | Consumers must import from individual files (e.g., `import { ContactPicker } from "@/components/pickers/contact-picker"`). All plan files specify this pattern explicitly. Not a defect — just a DX convenience that was not required. |
| `useDeals()` in `deal-picker.tsx` called with no args — returns all deals | Low | The picker will show ALL deals across all pipelines and stages. For disambiguation, stage name is shown per item. No requirement specified filtering; this is the correct behavior for a generic picker. |
| No loading/skeleton state in picker trigger | Low | While data is fetching, trigger shows only the placeholder or the `value` fallback text. A skeleton or spinner was not specified in the requirements. Acceptable for initial delivery. |

## Summary

Phase 2 goal is met. All four Popover+Command pickers are implemented, exported from predictable file paths, share a consistent 5-prop interface (`value`, `onChange`, `placeholder`, `disabled`, `className`), and compile cleanly. The company picker ships with the full backend stack it requires (data access layer, authenticated API route, React Query hook). Static verification is clean; browser verification is required for 5 UX/runtime items before marking PICK-01 through PICK-05 as fully done in `REQUIREMENTS.md`.

**Score: 14/15** (1 item requires human/browser verification — runtime rendering of all four pickers against live data)
