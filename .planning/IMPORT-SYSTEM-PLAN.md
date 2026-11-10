# Import System Overhaul — Implementation Plan

## Context

The current import system has several fundamental issues:
1. Browser-driven batching causes timeouts → false error reports ("0 created" when all were created)
2. No dedup for company imports
3. Contact dedup is optional/skippable
4. Auto-created companies (from contact import) have no dedup at all
5. Domain matching is raw string comparison — no normalization
6. Company name matching is exact only — "Whop Inc" ≠ "Whop"
7. Sequential row-by-row processing is slow (2-3 DB queries per row)

## What Already Exists (Leverage This)

- `src/lib/api/duplicates.ts` — `findDuplicateContacts()` and `findDuplicateCompanies()` with confidence scoring (95% domain, 70% name, 95% email, 85% phone, 60% name match)
- `src/app/api/contacts/duplicates/route.ts` — API endpoint for contact dedup
- `src/app/api/companies/duplicates/route.ts` — API endpoint for company dedup
- `src/components/companies/company-form.tsx` — Manual create form already calls `/api/companies/duplicates` and shows "Possible Duplicates Found" dialog with "Create Anyway" option
- `src/app/api/contacts/merge/route.ts` — Contact merge with field resolution
- `src/app/api/companies/merge/route.ts` — Company merge with field resolution, re-links deals/activities/contacts/tags
- `alerts` table with `type`, `title`, `message`, `severity`, `metadata`, `isRead` + `NotificationBell` UI component
- `alertTypeEnum` — currently has: gmv_drop, gmv_milestone, churn_risk_increase, inactive_creator, deal_stale, task_overdue, health_score_drop, new_creator_onboarded

---

## Architecture: Background Import Jobs

### New Flow

```
WIZARD (client)                          SERVER (background)
─────────────────                        ───────────────────
Step 1: Upload CSV
Step 2: Map columns
        ↓ immediately after mapping:
        within-CSV dedup (auto, keep first)
Step 3: Preview & validate (clean data)
Step 4: Dedup against CRM + field resolution
Step 5: User clicks "Import"
  → POST /api/import-jobs               → Creates job record (status: "pending")
  → Dialog closes                        → Kicks off processing via after()
  → Toast: "Import started"             → Status: "processing"
  → User keeps working                  → Processes rows (batch inserts, company matching, etc.)
                                         → Status: "complete" or "failed"
                                         → Creates alert notification
  ← Notification bell lights up
  ← User sees: "Import complete:
     847 created, 3 skipped, 2 updated"
```

### New DB Table: `import_jobs`

```
import_jobs
├── id              uuid PK
├── userId          uuid FK → users.id
├── entityType      text ("contact" | "company")
├── status          text ("pending" | "processing" | "complete" | "failed")
├── payload         jsonb (the full validated + dedup-resolved rows)
├── totalRows       integer
├── processedRows   integer (default 0, updated during processing)
├── results         jsonb (null until complete: { created, skipped, updated, errors, errorDetails })
├── createdAt       timestamp
├── completedAt     timestamp (null until done)
```

### New Alert Type

Add `"import_complete"` to `alertTypeEnum`.

Alert created on completion:
- **title:** "Contact import complete" or "Company import complete"
- **message:** "847 contacts created, 12 skipped, 3 updated"
- **severity:** "info" (or "warning" if errors > 0)
- **metadata:** `{ jobId, created, skipped, updated, errors }`

### Background Processing

Next.js 16 supports `after()` from `next/server` — runs a callback after the response is sent. The import job API:

1. Validates the payload
2. Inserts the `import_jobs` row with status "pending"
3. Returns `{ jobId, status: "pending" }` immediately
4. `after()` kicks off the actual processing
5. Processing updates `processedRows` as it goes
6. On completion: updates status, writes results, creates alert

### Recovery

If the server crashes mid-import, the job stays "processing" forever. Simple fix:
- On app startup or via a periodic check: any job that's been "processing" for > 10 minutes → mark as "failed"
- Alert the user: "Import interrupted — X of Y rows processed. Re-import remaining rows."

### Import History Page

`/admin/imports` — a simple table listing past import jobs:

```
Date         Type      Status    Created  Skipped  Updated  Errors  User
Mar 5, 2026  Contacts  Complete  847      12       3        0       Nico
Mar 3, 2026  Companies Complete  234      0        0        0       Nico
Feb 28, 2026 Contacts  Failed    412/800  —        —        —       Sarah
```

Click into a job to see error details: "Row 47: invalid email format", "Row 203: ambiguous company match." Useful for debugging and auditing. Low build cost since the data is already stored in `import_jobs`.

---

## Within-CSV Dedup (Happens Before Preview)

Runs immediately after column mapping (between Step 2 and Step 3). Before dirty data ever enters the wizard flow.

### For Contact Imports
- Scan all rows for duplicate **emails** (using the mapped email column)
- If duplicates found: auto-remove, keep first occurrence
- Show callout: "4 duplicate rows removed from your CSV (matched by email). First occurrence kept."
- If the duplicate rows had **different data** for other fields, note it: "4 duplicate emails found with differing data — first occurrence kept."

### For Company Imports
- Scan all rows for duplicate **domains** (normalized) and duplicate **names** (normalized)
- Same behavior: auto-remove, keep first, show count

### Key Point
This is automatic, not a decision point. The user sees a count. If they disagree, they fix the CSV and re-upload. Dirty data never reaches the preview, validation, or dedup steps.

---

## Domain Normalization

### `normalizeDomain(raw: string): string | null`

New utility function used everywhere domains are stored or compared.

```
Input                              Output
─────                              ──────
"https://www.whop.com/pricing"  →  "whop.com"
"http://WWW.WHOP.COM"          →  "whop.com"
"www.whop.com"                  →  "whop.com"
"WHOP.COM"                     →  "whop.com"
"whop.com"                     →  "whop.com"
""                             →  null
null                           →  null
```

Logic: strip protocol (`https?://`), strip `www.`, strip trailing path/query/hash, lowercase, trim.

### Where It's Applied

1. **Company creation** (`createCompany`) — normalize domain before INSERT
2. **Company update** (`updateCompany`) — normalize domain before UPDATE
3. **Import company matching** — normalize incoming domain before lookup
4. **Duplicate detection** (`findDuplicateCompanies`) — normalize before comparing
5. **Manual company form** — normalize before dedup check
6. **Within-CSV dedup** — normalize before comparing domains within the CSV

### Unique Constraint

Add partial unique index: `CREATE UNIQUE INDEX idx_companies_domain_unique ON companies (domain) WHERE domain IS NOT NULL`

This means:
- Two companies can both have `domain = null` (allowed)
- Two companies cannot both have `domain = "whop.com"` (blocked)
- All stored domains are already normalized, so the constraint works reliably

### Migration for Existing Data

Before adding the constraint:
1. Run a report script — normalize all existing company domains, find conflicts
2. Present conflicts to user for manual resolution (merge using existing merge tool)
3. Do NOT auto-merge — user decides which record is the master
4. Once clean, add the constraint

---

## Company Name Normalization (Matching Only)

### `normalizeCompanyName(raw: string): string`

Used for **matching** only — NOT for storage. The displayed name stays as the user entered it.

```
Input                 Output
─────                 ──────
"Whop Inc"         →  "whop"
"Whop, Inc."       →  "whop"
"WHOP LLC"         →  "whop"
"The Whop Co."     →  "whop"
"  Whop  "         →  "whop"
"Whop"             →  "whop"
```

Logic: lowercase, trim, strip common suffixes (Inc, LLC, Ltd, Co, Corp, Company, Corporation, Incorporated, Limited, Group, Holdings, The, &), strip punctuation (commas, periods).

### Where It's Applied

Only in matching contexts:
1. Import company matching (name-only fallback)
2. Duplicate detection (`findDuplicateCompanies`) — in addition to the existing `ilike` match
3. Within-CSV dedup for company imports (when no domain present)

---

## Contact→Company Linking Rules (During Contact Import)

When a contact import row has company fields, the background processor applies this logic:

### Decision Tree

```
Has companyDomain?
├─ YES
│   normalize domain → lookup companies.domain
│   ├─ MATCH found → link contact to existing company
│   └─ NO MATCH
│       create new company (with normalized domain + companyName if provided)
│       link contact to new company
│
└─ NO
    Has companyName?
    ├─ YES
    │   normalize name → case-insensitive lookup
    │   ├─ 1 MATCH → link contact to existing company
    │   ├─ MULTIPLE MATCHES → DO NOT link. Flag in results: "ambiguous company match for 'Apex' — link manually"
    │   └─ NO MATCH → DO NOT create company. DO NOT link. Flag in results: "no company found for 'Apex' — create and link manually"
    │
    └─ NO → no company linking (just create the contact)
```

### Key Principles

- **Domain = strong identifier** → trusted for both matching and creating
- **Name alone = weak identifier** → trusted only for matching (1 exact match), never for creating
- **Ambiguous = hands off** → flag it, let the user resolve manually
- **Within a single import**: if the same domain appears on multiple rows, create the company once on first encounter, reuse for all subsequent rows (in-memory map during processing)

---

## Dedup Resolution Against CRM Data (Step 4)

### Contact Import — Dedup Step

Mandatory when email column is mapped. Checks imported contacts against existing CRM contacts.

**For each match found, user sees a side-by-side field comparison:**

```
Field          In CRM (existing)     In CSV (incoming)      Keep
─────          ─────────────────     ─────────────────      ────
First Name     John                  Jonathan               ○ CRM  ● CSV
Last Name      Smith                 Smith                  ● CRM  ○ CSV
Email          john@whop.com         john@whop.com          ● CRM  ○ CSV
Phone          (empty)               555-0123               ○ CRM  ● CSV
Type           creator               lead                   ● CRM  ○ CSV
```

**Actions per duplicate:**
- **Skip** — don't import this row (filtered out of payload)
- **Overwrite** — update existing contact using field-by-field resolution above
- **Create anyway** — import as new contact (for intentional duplicates)

**Defaults for field resolution:**
- If CSV has data and CRM is empty → default to CSV (filling gaps)
- If CRM has data and CSV is empty → default to CRM (don't blank things out)
- If both have data and they differ → default to CSV (import is presumably newer), user can override

**Bulk controls for efficiency:**
- "For all duplicates: Keep CRM data / Prefer CSV data / Skip all"
- User can then expand individual duplicates to override field-by-field
- Common case: one click on a bulk default, maybe override 2-3, move on

### Company Import — Dedup Step

Same pattern as contacts. Checks by normalized domain first, then normalized name.

**Same field-by-field resolution UI:**

```
Field          In CRM (existing)     In CSV (incoming)      Keep
─────          ─────────────────     ─────────────────      ────
Name           Whop                  Whop Inc               ○ CRM  ● CSV
Domain         whop.com              whop.com               ● CRM  ○ CSV
Industry       Technology            (empty)                ● CRM  ○ CSV
Size           201-1000              1000+                  ○ CRM  ● CSV
```

**Same actions:** Skip / Overwrite (with field resolution) / Create anyway

**Overwrite safety rule:** only update fields that have values in the CSV. Never blank out existing CRM data with empty CSV cells.

### Contact Import — Company Linking Preview

After dedup resolution, before submitting, show a summary of what will happen with company linking:

```
Company Linking Preview
───────────────────────
✓ 234 contacts → linked to existing companies (by domain)
✓  45 contacts → linked to existing companies (by name)
+  12 companies will be auto-created (new domains)
⚠   8 contacts → ambiguous company match (link manually after import)
⚠  15 contacts → company not found, no domain (link manually after import)
○ 186 contacts → no company info provided
```

Minimal summary by default. Expandable "Review matches" section shows only the interesting cases: new companies being created and ambiguous/unresolved matches. The clean domain matches don't need review.

---

## Wizard Steps (Final)

### Step 1: Upload
- Drag & drop or file picker
- Parse CSV, show row count

### Step 2: Map Columns
- Auto-map by header aliases
- User adjusts manually
- **Immediately after mapping:** within-CSV dedup runs
  - Contacts: dedup by email
  - Companies: dedup by normalized domain, then normalized name
  - Auto-removes duplicates, keeps first occurrence
  - Shows callout with count if any removed

### Step 3: Preview & Validate
- Shows first 5 rows of **clean** (deduped) data
- Zod validation per row
- Shows valid/invalid counts
- Invalid rows are excluded from import
- Gate: cannot proceed if 0 valid rows

### Step 4: Dedup & Resolve
- **Contacts:** check emails against existing CRM contacts
  - Matches shown with side-by-side field comparison
  - Bulk default: "Prefer CSV / Keep CRM / Skip all"
  - Per-duplicate override with field-by-field resolution
- **Companies:** check normalized domain, then normalized name against existing
  - Same field comparison and resolution UI
- **Contact imports only:** company linking preview summary
- Gate: all duplicates must be resolved (skip, overwrite, or create anyway)

### Step 5: Confirm & Submit
- Final summary:
  - X will be created
  - Y will be updated (overwrites)
  - Z were skipped
  - For contacts: company linking summary
- User clicks "Start Import"
- Single `POST /api/import-jobs` with full resolved payload
- Dialog closes immediately
- Toast: "Import started — you'll be notified when it's complete"

---

## Performance: Batch Operations

The background processor doesn't have timeout pressure, but we should still be efficient.

### Simple Rows (no custom fields, no overwrites, no company linking)
- Reserve N CRM IDs in a single query (`UPDATE ... SET nextVal = nextVal + N RETURNING`)
- Single batch INSERT for all N contacts/companies
- ~2 queries total instead of 2N

### Complex Rows (custom fields, overwrites, company linking)
- Process row-by-row (same as current)
- But no timeout risk since it's background

### Progress Tracking
- Update `import_jobs.processedRows` every 50 rows
- Not exposed to UI in real-time (no polling/websockets needed)
- Final results written on completion

---

## Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/utils/normalize.ts` | `normalizeDomain()` and `normalizeCompanyName()` |
| `src/app/api/import-jobs/route.ts` | POST: create job + kick off processing. GET: list jobs / check status |
| `src/app/api/import-jobs/[id]/route.ts` | GET: single job detail with error breakdown |
| `src/lib/api/import-processor.ts` | Background processing logic (contact + company imports) |
| `src/app/(dashboard)/admin/imports/page.tsx` | Import history page |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `importJobs` table, add `"import_complete"` to alertTypeEnum |
| `src/lib/db/crm-id.ts` | Add `generateCrmIdBatch()` for batch ID reservation |
| `src/lib/api/companies.ts` | `createCompany` and `updateCompany` normalize domain before write |
| `src/lib/api/contacts.ts` | Add `bulkCreateContacts()` for batch inserts |
| `src/lib/api/duplicates.ts` | Use `normalizeDomain` and `normalizeCompanyName` for matching |
| `src/components/import/import-wizard-dialog.tsx` | Full rewrite: within-CSV dedup, field resolution UI, job submission |
| `src/components/layout/notification-bell.tsx` | Handle `import_complete` alert type with link to job detail |
| `src/app/api/bulk/route.ts` | Remove `import_contacts` and `import_companies` handlers (moved to import-processor) |

---

## Edge Cases & Decisions

| Case | Decision |
|------|----------|
| Contact email not mapped | Skip dedup step (can't check without emails). Show warning: "No email column mapped — duplicate detection is not possible." |
| CSV has 0 valid rows after validation | Don't allow submission. Show error in preview step. |
| Within-CSV: same email, different data | Auto-remove duplicate, keep first. Show: "X duplicate emails found with differing data — first occurrence kept." |
| Within-CSV: same email, identical data | Auto-remove silently. Show count. |
| Same domain in CSV across multiple contact rows | First row triggers company creation. All subsequent rows link to it (in-memory map). |
| Company domain matches existing but name differs | Trust domain. Link to existing company. Name difference is informational only. |
| companyName only, no match in CRM | Do NOT create company. Flag: "no company found for 'NewCo' — create and link manually." |
| companyName only, multiple matches in CRM | Do NOT link. Flag: "ambiguous company match for 'Apex' — link manually." |
| Overwrite selected but CSV field is empty | Keep CRM value. Never blank out existing data with empty CSV cells. |
| Background job fails mid-processing | Mark as "failed". Alert user with partial results (X of Y processed). |
| Import job submitted, server crashes before starting | Job stays "pending". Recovery check marks it failed after 10 min. |
| Two users import simultaneously | CRM ID generation is atomic. Domain unique constraint prevents duplicate companies. Both imports succeed independently. |
| Domain unique constraint blocks company creation during import | Catch constraint violation, treat as "match found", link to existing company. |
| Existing data has duplicate domains before migration | Report conflicts first. User merges manually. Constraint added only after data is clean. |

---

## Implementation Order

### Phase A: Foundation (no UX changes yet)
1. Create `normalizeDomain()` and `normalizeCompanyName()` utilities
2. Update `createCompany` to normalize domain before INSERT
3. Update `updateCompany` to normalize domain before UPDATE
4. Update `findDuplicateCompanies` to use normalized matching
5. Normalize existing company domains in DB (run report, flag conflicts)
6. Resolve domain conflicts (manual merge)
7. Add partial unique index on `companies.domain`

### Phase B: Background Infrastructure
1. Add `importJobs` table to schema + `"import_complete"` to alertTypeEnum
2. Push migration
3. Create `POST /api/import-jobs` route (accepts payload, returns immediately)
4. Create `import-processor.ts` (background processing with company matching rules)
5. Add `generateCrmIdBatch()` to `crm-id.ts`
6. Add `bulkCreateContacts()` to `contacts.ts`

### Phase C: Wizard Overhaul
1. Add within-CSV dedup (runs after column mapping, before preview)
2. Build field-by-field resolution UI component
3. Rework Step 4 → Dedup & Resolve (mandatory contact dedup, new company dedup, field resolution, company linking preview)
4. Rework Step 5 → Confirm & Submit (single POST to /api/import-jobs, dialog closes)
5. Remove old batching logic from wizard
6. Remove `import_contacts` / `import_companies` handlers from bulk route

### Phase D: Notification, History & Polish
1. Update notification bell to handle `import_complete` alerts
2. Build `/admin/imports` page (job list + detail view with error breakdown)
3. Add job recovery check (stale "processing" jobs → mark failed)
4. Test full flow end-to-end

---

## Verification

1. Import 1000 contacts with mixed company data → completes in background, notification appears
2. Re-import same CSV → dedup catches all duplicates, field resolution works
3. Upload CSV with internal duplicates → auto-removed before preview, count shown
4. Import contacts with `companyDomain: "whop.com"` → links to existing Whop company (normalized)
5. Import contacts with only `companyName: "Whop"` + 1 match exists → links correctly
6. Import contacts with only `companyName: "NewCo"` + no match → flags it, does NOT create company
7. Import contacts with `companyName: "Apex"` + multiple matches → flags as ambiguous
8. Import companies with duplicate domains → dedup catches them, field resolution available
9. Overwrite a contact → empty CSV fields don't blank out CRM data, populated fields update
10. Two concurrent imports → no CRM ID collisions, no duplicate companies via domain constraint
11. Server restart mid-import → job marked failed, user notified with partial count
12. Manual company creation with existing domain → duplicate warning shown
13. Check `/admin/imports` → shows all past jobs with status and error details
