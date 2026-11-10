# Shortcomings Remediation Plan

## Priority 1: Critical (Blocking core functionality)

### 1A. Admin Bootstrap Flow
**Problem:** First user to sign up gets "ae" role by default. No way to become admin without direct DB edit.
**Fix:** If no admin exists in the system, auto-promote the first user to "admin" role on login.
**Files:** `src/lib/auth/helpers.ts`

### 1B. Permission UI Enforcement
**Problem:** Admin permission matrix (role × entity → CRUD + scope) is stored but never enforced in the UI. All users see all sidebar items and all action buttons regardless of role.
**Fix:**
- Create a `usePermissions()` hook that fetches current user's effective permissions
- Gate sidebar nav items based on entity read permissions
- Gate create/edit/delete buttons based on entity write permissions
- Gate bulk actions based on entity permissions
**Files:** New `src/lib/hooks/use-permissions.ts`, modify `src/components/layout/sidebar.tsx`, modify list pages

### 1C. Team Management UI
**Problem:** Teams table exists in schema but no UI to create/manage teams or assign users to teams.
**Fix:** Add Teams tab to admin settings with CRUD for teams and member assignment.
**Files:** New `src/app/api/teams/` routes, new `src/components/admin/team-manager.tsx`, modify admin page

---

## Priority 2: High (Major feature gaps)

### 2A. Automated Health Score Calculation
**Problem:** Health score is manual-only (admin sets it). No automated calculation based on activity recency, deal velocity, engagement.
**Fix:** Add a `calculateHealthScore()` function that runs on activity creation and deal stage changes, computing score from weighted factors.
**Files:** New `src/lib/api/health-score.ts`, modify activity creation API, modify deal update API

### 2B. Alert Automation / Rules Engine
**Problem:** Alerts page exists but alerts are only created manually. No automatic triggers for stale contacts, overdue tasks, deal aging, etc.
**Fix:** Add cron-style background check (API route callable by Vercel cron) that evaluates alert rules and creates alerts.
**Files:** New `src/app/api/cron/alerts/route.ts`, new `src/lib/api/alert-rules.ts`

### 2C. Contact Merge UI Completion
**Problem:** Merge API endpoints exist but the UI merge dialog is incomplete — doesn't handle all field types and lacks preview of merged result.
**Fix:** Complete the merge dialog with field-by-field conflict resolution and preview.
**Files:** `src/components/merge/merge-contacts-dialog.tsx`, `src/components/merge/merge-companies-dialog.tsx`

### 2D. Full-Text Search Enhancement
**Problem:** Search uses ILIKE which is slow and doesn't rank results. No search across activities or notes content.
**Fix:** Add pg_trgm index for fuzzy matching, add activity/note content to search results.
**Files:** New migration for trgm indexes, modify `src/app/api/search/route.ts`

---

## Priority 3: Medium (Quality & completeness)

### 3A. Import Deduplication
**Problem:** CSV import doesn't check for duplicate emails/companies before inserting, creating duplicates.
**Fix:** Add duplicate detection pass before import, show user matches and let them skip/merge/overwrite.
**Files:** Modify `src/components/import/import-wizard-dialog.tsx`, modify bulk import API

### 3B. Checklist Exit Gates
**Problem:** Pipeline stage checklists exist but don't block stage transitions. A deal can move to next stage with incomplete checklist.
**Fix:** Add "required" flag to checklist items, validate on stage transition in deal update API.
**Files:** Modify `src/lib/api/deals.ts` (updateDeal), modify `src/lib/api/checklists.ts`

### 3C. Deal Aging Alerts
**Problem:** No visual indicator when a deal has been sitting in a stage too long.
**Fix:** Add "days in stage" calculation to deal cards and list, with color coding (green/yellow/red based on configurable thresholds).
**Files:** Modify `src/components/pipeline/deal-card.tsx`, modify `src/app/(dashboard)/deals/page.tsx`

### 3D. Currency Normalization
**Problem:** Deal values can be in different currencies but pipeline totals just sum raw numbers regardless of currency.
**Fix:** Add currency display to pipeline column totals, group by currency or convert to base currency.
**Files:** Modify `src/components/pipeline/kanban-column.tsx`, modify pipeline page

### 3E. Saved View Auto-Update
**Problem:** Saved views store filter snapshots but don't update column visibility when new columns are added.
**Fix:** When loading a saved view, merge stored columns with available columns (show new columns by default).
**Files:** Modify list pages where `handleLoadView` is called

---

## Priority 4: Lower (Nice-to-have improvements)

### 4A. Recurring Tasks
**Problem:** Tasks are one-shot only. No way to create recurring tasks (weekly check-ins, monthly reviews).
**Fix:** Add recurrence fields to task schema (pattern, interval, nextDue), auto-create next task on completion.
**Files:** Schema migration, modify `src/app/api/tasks/[id]/route.ts`

### 4B. Tag Hierarchy
**Problem:** Tags are flat. No parent/child or category grouping.
**Fix:** Add parentId to tags table, show grouped in tag selector.
**Files:** Schema migration, modify tag selector components

### 4C. Report Scheduling
**Problem:** Reports are on-demand only. No way to schedule weekly/monthly email reports.
**Fix:** Requires email integration first (Priority 2 dependency). Defer.

### 4D. File Attachments
**Problem:** No file upload capability on contacts, deals, or companies.
**Fix:** Requires blob storage setup (S3/Vercel Blob). Defer until infrastructure decision.

---

## Implementation Batches

### Batch 1 (Agents deploying now — pure code, no external deps)
1. **Agent A:** Admin bootstrap + permission hook + sidebar gating (1A + 1B)
2. **Agent B:** Team management UI (1C)
3. **Agent C:** Health score automation + deal aging alerts (2A + 3C)
4. **Agent D:** Alert automation cron (2B)
5. **Agent E:** Import dedup + checklist exit gates (3A + 3B)
6. **Agent F:** Currency normalization + saved view fix + search enhancement (3D + 3E + 2D)

### Batch 2 (Requires review/external setup — deferred)
- Email integration (needs SMTP/SendGrid config)
- Whop API sync (needs API keys)
- File attachments (needs blob storage)
- Report scheduling (needs email first)
- Recurring tasks + tag hierarchy (schema migrations needed)
