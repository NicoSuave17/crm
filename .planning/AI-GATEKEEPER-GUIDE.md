# AI Gatekeeper — Complete Technical Guide

## What Is It?

The AI Gatekeeper is a server-side data quality layer that sits between every data mutation in the CRM and the database. Before any contact, company, or deal is created or updated — whether from a form, CSV import, bulk operation, or merge — it passes through three AI analysis chains powered by OpenRouter:

1. **Normalization** — Standardizes phone numbers, emails, names, URLs, company names
2. **Entity Resolution** — Detects duplicates by querying the DB and asking an LLM to judge matches
3. **Semantic Validation** — Catches swapped fields, test data, implausible values, missing context

Based on the combined confidence from all three chains, the record is routed to one of three zones:

| Zone | Confidence | What Happens |
|------|-----------|--------------|
| **Auto-Apply** | >= 95% | Record is saved with normalized data. User sees normal success. |
| **Review** | 70-94% | Record goes to the Review Queue. User sees "Submitted for review" toast. API returns 202. |
| **Reject** | < 70% | Record is rejected. User sees validation errors from the AI. API returns 422. |

---

## How to Get the OpenRouter API Key Working

The key is already in `.env.local`:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

**Without the key:** The system is fail-open. Every mutation passes through normally as if the gatekeeper doesn't exist. No AI analysis happens. This is by design — the CRM never breaks because of AI being unavailable.

**With the key:** All three AI chains run on every create/update operation across contacts, companies, and deals.

---

## What You'll Experience When Testing

### 1. Creating a Contact (Form)

**Clean data (should auto-apply):**
- Go to Contacts > New Contact
- Enter: `John Smith`, `john@example.com`, `(415) 555-1234`
- Submit
- **Expected:** Contact created normally. Behind the scenes, the gatekeeper:
  - Normalized the phone to `+14155551234`
  - Lowercased the email
  - Checked for existing contacts with that email/phone
  - Validated no semantic issues
  - Confidence ~98% → auto-apply
  - Decision logged to `gatekeeper_decision_log`
- **Latency:** ~4-8 seconds added to the request (three LLM calls)

**Suspicious data (should go to review):**
- Create a contact with an email that already exists in the system
- Or enter data where name fields look swapped (first name = "Smith", last name = "John")
- **Expected:** Toast says "Submitted for review". The API returned 202. The record is NOT in the contacts list yet — it's in the Review Queue waiting for approval.

**Bad data (should reject):**
- Enter: name = "asdfasdf", email = "notanemail", phone = "123"
- **Expected:** Error toast with AI-detected issues. The API returned 422.

### 2. Creating a Company or Deal

Same flow as contacts. The gatekeeper protects all three entity types.

### 3. Updating Records

When you edit an existing contact/company/deal:
- The gatekeeper receives both the incoming changes AND the existing record
- It runs survivorship rules to determine which values should win
- Same zone routing applies

### 4. The Review Queue Page

Navigate to **Review Queue** in the sidebar (has a Shield icon). You'll see:

**Stats Bar (top):**
- Pending count (items waiting for review)
- Approved today
- Rejected today
- Auto-apply rate (percentage of records that passed without review)

**Table:**
- Each row shows: entity type, operation, source, confidence score, date
- Click a row to expand it and see the full AI analysis

**Expanded Row (Review Detail Panel):**
- **Field Diff Viewer:** Three columns showing Incoming | Existing | Normalized data, with changed fields highlighted in amber
- **Semantic Issues:** Any AI-flagged problems with severity icons
- **Duplicate Matches:** If the AI found potential duplicates, they're listed with confidence scores
- **Actions:**
  - **Approve** — Executes the original create/update with the normalized data
  - **Reject** — Marks as rejected, record is never created
  - **Notes** — Add review notes before approving/rejecting

**Badge Count:** The sidebar shows an amber badge with the number of pending review items (updates every 30 seconds).

### 5. CSV Import with AI Field Mapping

Go to any entity list and use the Import button:

**Step 2 (Field Mapping):**
- Instead of the old alias-based matching, the system now sends your CSV headers + sample rows to an LLM
- The AI understands context: "Mobile" → phone, "Organisation" → companyName, "ARR" → revenue, foreign language headers
- Each mapping shows a confidence score
- You can still override any mapping manually
- **Fallback:** If the API call fails, it silently falls back to the old alias-based mapping

**After Import:**
- Rows are processed in batches of 30 through the gatekeeper
- Each row gets its own confidence score and zone routing
- Auto-apply rows are created immediately
- Review rows appear in the Review Queue
- Rejected rows show in the import error details

### 6. Merge Operations

When merging two contacts or companies:
- The entire merge is now wrapped in a database transaction (Bug #6 fix)
- If any step fails, everything rolls back — no more corrupted data from partial merges
- Survivorship rules determine which field values win:
  - `most_complete`: Longer/non-null value wins (used for names, emails, URLs)
  - `most_recent`: Newer timestamp wins (used for status, tier)
  - `manual`: Sent to review queue for human decision (used for owner assignment)

### 7. Bulk Operations

Bulk actions (reassign, tag, status change) are logged to the `gatekeeper_decision_log` for audit trail, but don't go through AI analysis (the data is already in the system).

---

## The Six Bug Fixes (Phase 0)

These were prerequisites fixed before building the AI layer:

### Bug 1: Company Dedup During Import Was Broken
**Was:** Import wizard POSTed to `/api/companies/duplicates` which only had a GET handler → silent 405 error, no dedup happened for companies.
**Fix:** Created `/api/companies/duplicates/check` with a batch POST handler matching the contacts pattern. Updated import wizard to call it.

### Bug 2: Non-Email Duplicate Resolutions Silently Ignored
**Was:** `buildPayload()` in import wizard used an email-only lookup map. If duplicates were found by LinkedIn URL or name match, the resolution (skip/overwrite) was ignored and the row was imported as a new record.
**Fix:** Multi-key lookup: tries email first, then LinkedIn URL, then name to find the user's resolution choice.

### Bug 3: Custom Field Values Mapped to Wrong Contacts
**Was:** After batch insert, custom field values were assigned by array index. But if some rows failed validation, the `ids` array (successful inserts) was shorter than the `simpleCreates` array (all rows), causing a misalignment.
**Fix:** Track `validRowIndices` to map each successful insert ID back to the correct source row's custom field values.

### Bug 4: No Email Uniqueness Constraint
**Was:** Multiple contacts could share the same email address, making dedup unreliable.
**Fix:** Added `UNIQUE INDEX ON contacts(email) WHERE email IS NOT NULL` + added the same to the Drizzle schema.

### Bug 5: Phone Matching Used Raw Strings
**Was:** `findDuplicateContacts()` compared raw phone strings — so `(415) 555-1234` wouldn't match `4155551234`.
**Fix:** Added `normalizedPhone` column (digits only). Populated on every create/update. Dedup queries now use this column. Backfilled existing contacts in migration.

### Bug 6: Merges Not Wrapped in Transactions
**Was:** Contact and company merges ran 6-7 sequential DB operations without a transaction. If step 4 failed, steps 1-3 were committed, leaving corrupted data.
**Fix:** Wrapped both merge handlers in `db.transaction()`.

---

## Architecture Deep Dive

### File Structure

```
src/lib/ai/
  openrouter.ts          — LLM API client (retry, model tiers, token tracking)
  gatekeeper.ts          — Main orchestrator (runs 3 chains, calculates confidence)
  confidence.ts          — Scoring algorithms and zone thresholds
  survivorship.ts        — Field conflict resolution for merges/updates
  batch-processor.ts     — Groups import rows into batches of 30
  route-helper.ts        — Shared helper for API routes to call gatekeeper
  prompts/
    normalization.ts     — Chain 1: Phone/email/name/URL standardization
    entity-resolution.ts — Chain 2: Duplicate detection + LLM judgment
    semantic-validation.ts — Chain 3: Data quality checks
    field-mapping.ts     — CSV column → CRM field AI mapping

src/app/api/gatekeeper/
  review/route.ts        — GET list + POST approve/reject/edit
  review/[id]/route.ts   — GET single review detail
  stats/route.ts         — Dashboard metrics
  survivorship/route.ts  — GET/PUT survivorship rules
  map-fields/route.ts    — AI field mapping endpoint

src/app/(dashboard)/review/page.tsx     — Review Queue page
src/components/review/
  review-queue-table.tsx    — Filterable/sortable table
  review-detail-panel.tsx   — Full AI analysis + approve/reject
  field-diff-viewer.tsx     — Side-by-side field comparison

src/lib/hooks/use-review-queue.ts       — React Query hooks
```

### Model Tiers (via OpenRouter)

| Tier | Model | Cost | Used For |
|------|-------|------|----------|
| Fast | Llama 3.1 8B | ~$0.20/M tokens | Normalization (formatting, not reasoning) |
| Standard | GPT-4o Mini | ~$0.30/M tokens | Entity resolution, semantic validation, field mapping |
| Premium | Claude Sonnet 4 | ~$6.00/M tokens | Reserved for future complex decisions |

**Estimated cost per record:** ~1,900 tokens total across 3 chains = ~$0.0006 per record.

### Confidence Scoring

The overall confidence score uses a **weakest-link principle** — it's the MINIMUM of the three chain scores:

```
overallConfidence = min(normalizationScore, entityResolutionScore, semanticScore)
```

**Normalization scoring:**
- Errors → 50%
- No changes needed → 100%
- Changes made → `max(60, 100 - (changeRatio * 30))` — more changes = more suspicion

**Entity resolution scoring:**
- No duplicates found → 100%
- Duplicates found → Uses the AI's reported confidence (default 50%)

**Semantic validation scoring:**
- No issues → 100%
- Errors → `max(20, 60 - (errorCount * 20))` — catastrophic penalty
- Warnings → `max(60, 90 - (warningCount * 10))`
- Info only → 95%

**Thresholds (configurable via env vars):**
```
GATEKEEPER_AUTO_APPLY_THRESHOLD=95   # >= this → auto_apply
GATEKEEPER_REVIEW_THRESHOLD=70       # >= this → review, below → reject
```

### Database Tables

**`gatekeeper_decision_log`** — Immutable audit trail of every AI decision
- Every create/update/merge/import row gets a log entry
- Stores: confidence, zone, full analysis JSONB, tokens used, latency
- Used for: stats dashboard, cost tracking, compliance auditing

**`gatekeeper_review_queue`** — Items pending human review
- Created when confidence is 70-94%
- Stores: incoming data, normalized data, existing record, AI analysis
- Status flow: `pending_review` → `approved` | `rejected` | `expired`
- 30-day expiry set on creation

**`gatekeeper_survivorship_rules`** — Per-field merge conflict resolution rules
- Unique constraint: (entity_type, field)
- Default rules loaded if none exist in DB
- Admin-configurable via Settings or API

### Data Flow Diagram

```
User Action (form / import / bulk / merge)
    │
    ▼
API Route (Zod validation)
    │
    ▼
gatekeeperCheck() ─── route-helper.ts
    │
    ├─ gatekeeperAnalyze() ─── gatekeeper.ts
    │   │
    │   ├─ Step 1: normalizeRecords() ─── prompts/normalization.ts
    │   │   └─ callOpenRouter(fast tier) ─── openrouter.ts
    │   │
    │   ├─ Step 2a: findDuplicates() ─── duplicates.ts (DB query)
    │   │   └─ resolveEntities() ─── prompts/entity-resolution.ts
    │   │       └─ callOpenRouter(standard tier)
    │   │
    │   ├─ Step 2b: validateSemantics() ─── prompts/semantic-validation.ts
    │   │   └─ callOpenRouter(standard tier)
    │   │   (2a and 2b run in parallel)
    │   │
    │   └─ Step 3: calculateConfidence() → getZone()
    │
    ├─ Log to gatekeeper_decision_log
    │
    └─ Route:
        ├─ auto_apply → Return normalized data, proceed with create/update
        ├─ review → Insert into gatekeeper_review_queue, return 202
        └─ reject → Return 422 with semantic issues
```

### Protected Entry Points

Every data mutation in the CRM now passes through the gatekeeper:

| Route | Method | What's Protected |
|-------|--------|-----------------|
| `/api/contacts` | POST | Contact creation |
| `/api/contacts/[id]` | PATCH | Contact updates |
| `/api/companies` | POST | Company creation |
| `/api/companies/[id]` | PATCH | Company updates |
| `/api/deals` | POST | Deal creation |
| `/api/deals/[id]` | PATCH | Deal updates |
| `/api/bulk` | PATCH | Bulk operations (audit log only) |
| Import processor | async | CSV import rows (batched) |
| Merge routes | POST | Contact/company merges (transactional) |

### Client-Side Handling

The React Query mutation hooks in `use-contacts.ts`, `use-companies.ts`, and `use-deals.ts` handle the 202 response:

```typescript
// If gatekeeper sends to review queue
if (res.status === 202) {
  return { ...json, _pendingReview: true };
}
```

The consuming components can check `_pendingReview` to show a "Submitted for review" toast instead of the normal success message.

---

## Survivorship Rules

When updating a record or merging two records, the survivorship engine decides which value wins for each field:

| Strategy | Logic | Default Fields |
|----------|-------|---------------|
| `most_complete` | Longer / non-null value wins | email, phone, name, URLs, description |
| `most_recent` | Newer timestamp wins | status, tier, healthScore, MRR, GMV |
| `manual` | Sends to review queue | ownerId (always needs human decision) |
| `ai_decide` | Escalates to premium LLM | Not used by default (available for custom rules) |

Admins can configure these rules per entity type and field via `PUT /api/gatekeeper/survivorship`.

---

## Performance & Latency

**Per-record latency (with API key):**
- Normalization: 1-2s (fast model)
- Entity resolution: 2-4s (includes DB query + standard model)
- Semantic validation: 1-2s (standard model)
- **Total: ~4-8 seconds per record**

Since entity resolution and semantic validation run in parallel, the total is roughly:
`normalization time + max(entity resolution, semantic validation)`

**Import batches:**
- 30 rows per batch
- Each row processed individually through gatekeeper
- ~30-240 seconds per batch depending on OpenRouter response times

**Without API key:**
- Zero added latency — gatekeeper is a no-op

---

## Stats Dashboard

The Review Queue page shows real-time stats (refreshed every 30 seconds):

- **Pending:** Items waiting for review
- **Approved Today:** Items approved by reviewers
- **Rejected Today:** Items rejected by reviewers
- **Auto-Apply Rate:** What percentage of records passed without needing review

The stats API (`GET /api/gatekeeper/stats`) also tracks:
- `decisionsToday`: Total gatekeeper decisions
- `avgConfidence`: Average confidence score
- `tokensUsedToday`: Total token consumption (for cost monitoring)

---

## Fail-Open Design

The system never blocks valid operations due to AI failures:

| Failure | Behavior |
|---------|----------|
| No `OPENROUTER_API_KEY` | Gatekeeper returns auto_apply, data passes through unchanged |
| OpenRouter API down | Gatekeeper catches error, returns auto_apply |
| Single chain fails | Other chains still run, confidence calculated from available scores |
| Review queue insert fails | Falls back to auto_apply |
| Token budget exhausted | OpenRouter returns 429, retry with backoff, then fail-open |

---

## Known Limitations

1. **Latency on forms:** 4-8 seconds per save is noticeable. Could be improved with async processing + optimistic UI.
2. **No review expiry cleanup:** Items get `expires_at` set to 30 days but there's no cron job to mark them expired.
3. **ai_decide survivorship not implemented:** The strategy is accepted but falls through to review queue.
4. **No per-entity-type thresholds:** Same 95/70 thresholds for contacts, companies, and deals.
5. **Bulk operations audit-only:** Bulk reassign/tag/status changes are logged but not AI-analyzed.
6. **No cross-record validation in imports:** The AI can't flag "these 5 rows share the same phone number" — it validates row-by-row.
