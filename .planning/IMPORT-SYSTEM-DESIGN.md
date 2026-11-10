# Whop CRM: Import System Design

> **Status:** Design complete. API research complete (Spider.cloud tested live, Harvest API documented). Ready for implementation.
> **Scope:** Contacts and Companies — the two entities where imports cause the most damage.
> **Date:** 2026-03-06

---

## The Three Problems This System Solves

1. **A contact that already exists gets created again** (duplicate)
2. **A company that already exists gets created again** (duplicate)
3. **A contact gets created with no link to its company, or linked to the wrong company** (orphan / mislink)

Every import horror story traces back to one of these three. Everything else — formatting, encoding, junk values — is secondary. If we nail these three, the import system is fundamentally sound.

---

## The Import Flow

```
Step 1: Upload & Map columns
Step 2: Normalize + Intra-file dedup (instant, free)
Step 3: Deterministic matching against DB (instant, free)
Step 4: Quality gate — is this file good enough to proceed?
           If too messy → BLOCK with explanation
           If OK → proceed
Step 5: Preview — user reviews and confirms approved records
           "850 auto-resolved, 12 need your review, 3 rejected"
           User resolves the 12 uncertain matches
Step 6: Atomic commit of approved records
           Approved contacts/companies written to DB
Step 7: Enrichment pass (ASYNC, post-commit, for unresolved only)
           Spider.cloud + Harvest API for records that didn't meet criteria
           User gets notified when enrichment completes
           User can then approve enriched records or skip
Step 8: Post-commit verification
```

**Key flow change:** Enrichment does NOT block the import. Approved records commit immediately. Enrichment runs asynchronously AFTER for only the records that couldn't be resolved deterministically. The user gets a notification when enrichment is done and can then decide to approve or skip those remaining records. This means a 1,000-row import doesn't wait 60 seconds for scraping — the 850 clean records go in immediately, and the 150 uncertain ones get enriched in the background.

---

## Step 1: Upload & Map

User uploads a CSV. System:
- Detects delimiter (comma, semicolon, tab, pipe) by scoring column-count consistency across rows
- Detects encoding (UTF-8, Latin-1, etc.) via byte sequence analysis, strips BOM if present
- Presents parsed columns with sample data
- AI-suggests column mappings, user confirms/adjusts
- Validates mapped columns match expected types (email fields contain @, phone fields parse as numbers, etc.)
- If >30% of a mapped column fails type check → warn: "Column 'Phone' may be incorrectly mapped"

---

## Step 2: Normalize + Intra-File Dedup

### Normalization (applied to every value in every row)

**Emails:**
- Lowercase
- Strip gmail dots (j.o.h.n → john for @gmail.com only)
- Normalize plus-addressing (john+work@gmail.com → john@gmail.com)
- Trim whitespace, strip invisible characters

**Phones:**
- Strip all formatting (parens, dots, dashes, spaces)
- Normalize to E.164 (+14155551234)
- Non-parseable numbers flagged as validation error

**Company names (7-step pipeline):**
1. Strip legal suffixes (Inc, Corp, LLC, Ltd, GmbH, AG, SA, Pty Ltd) — store suffix separately
2. Standardize capitalization (Title Case, exception list for eBay, iPhone, IBM, AT&T)
3. Handle punctuation (remove periods from abbreviations, standardize & vs "and")
4. Normalize abbreviations (Intl → International, Mfg → Manufacturing)
5. Resolve parent/subsidiary awareness
6. Strip geographic qualifiers ("Google UK Limited" → "Google")
7. Remove leading "The" ("The Coca-Cola Company" → "Coca-Cola")

**Domains:**
- Lowercase, strip www., strip trailing slashes, strip protocol

**Person names:**
- Trim, collapse whitespace
- Separate prefixes (Dr, Mr, Mrs, Prof) and suffixes (Jr, Sr, III, PhD)
- Handle compound names (van der, de la, O')
- Store parsed components: prefix, first_name, middle_name, last_name, suffix

**Junk detection:**
- "N/A", "n/a", "test", "asdf", ".", " ", "none", "null", "undefined", "0", "---" → treated as empty (field nullified, row continues)
- Logged in normalization report

**Invisible character stripping (applied to ALL text fields):**
- U+00A0 (non-breaking space) → regular space
- U+200B (zero-width space) → remove
- U+200C/U+200D (zero-width non-joiner/joiner) → remove
- U+FEFF (BOM mid-string) → remove
- U+00AD (soft hyphen) → remove
- Collapse multiple spaces, trim leading/trailing

### Intra-File Dedup

Before looking at the database, deduplicate within the file itself:

1. Group rows by normalized email (if present)
2. Within each email group, if multiple rows exist → merge (keep the most complete data per field)
3. For rows without email, group by normalized phone
4. For rows with neither, group by normalized (first + last + company name)
5. Report: "Found X duplicates within your file. Merged down to Y unique records."

This prevents the scenario where rows 5 and 500 are the same person and both get created.

**Multiple emails per person:** When intra-file duplicates have different email addresses, we do NOT discard either. Both emails are preserved — contacts support multiple email fields (see "Multi-Value Contact Fields" section below). The user can later star/acknowledge which email is primary and most reliable.

---

## Step 3: Deterministic Matching Against DB

### Company Resolution (ALWAYS runs first)

Companies are the anchor. Resolve all companies before touching contacts.

Extract every unique company reference from the import (by name, domain, or both). For each:

```
Has domain?
  → Normalize domain
  → Exact match in DB? → LINK to existing company
  → No match → check name

Has name?
  → Normalize name (7-step pipeline)
  → Exact normalized match in DB? → LINK to existing company
  → Fuzzy match (Jaro-Winkler > 0.85)? → UNCERTAIN (needs enrichment or review)
  → No match → WILL CREATE NEW

No domain AND no name?
  → Contact will be flagged as "unlinked"
```

### Contact Resolution

For every deduplicated, normalized contact row, find potential matches:

**Matching tiers (in order of strength):**

| Tier | Signal | Confidence | Action |
|------|--------|------------|--------|
| 1 | Normalized email exact match in DB | 99% | Auto-update existing record |
| 2 | Normalized E.164 phone exact match in DB | 95% | Auto-update existing record |
| 3 | Normalized (first + last) match AND company resolves to same company | 85% | Auto-update existing record |
| 4 | Normalized (first + last) match, different or no company | 60-70% | UNCERTAIN — needs enrichment or review |
| 5 | No match on any field | — | Create new record |

**Decision thresholds:**
- >= 90% confidence → auto-resolve (update existing)
- 70-89% confidence → UNCERTAIN (hold for enrichment pass post-commit)
- < 70% → new record

### Contact-Company Change Detection

When a contact matches an existing record but references a DIFFERENT company:

**The company email is the deciding factor:**
- Import row has a **new company email** (different domain than existing record's company) → This person changed jobs. **Create a new contact record associated with the new company.** The old record stays linked to the old company. This is not a duplicate — it's a new professional identity.
- Import row has the **same company email** → Update the existing record (same person, same company, just new data).
- Import row has **no company email** and references a different company name → UNCERTAIN. If we have a LinkedIn URL, queue for enrichment (Agent 3: Harvest API) to verify current company. If no LinkedIn URL, flag for user review.

**We never delete or overwrite company associations.** If someone moved from Acme to Whop, both records exist — the Acme record reflects their history there, the Whop record reflects their current role.

---

## Step 4: Quality Gate

After deterministic matching, assess the file quality. The system should be able to say "this import is too messy to proceed."

**Auto-block thresholds:**
- > 30% of rows have validation errors → "This file has significant data quality issues. Fix these before importing."
- > 20% of company resolutions are uncertain → "Too many company matches are ambiguous. Consider adding domain or LinkedIn URL columns to your CSV."
- > 50% of contacts would be created without company links → "Most contacts in this file can't be linked to companies. Add company name or domain columns."

Don't just flag — **block the import** with a clear explanation of what's wrong and how to fix it. A bad import that creates 500 orphaned contacts is worse than no import.

**Pass thresholds:**
- If > 50% of rows resolve cleanly in Step 3 → good file, proceed to enrichment for uncertain rows
- If < 50% resolve cleanly → warn user, let them choose to proceed or fix the file first

---

## Step 7: Enrichment Pass (Async, Post-Commit)

**Enrichment runs AFTER approved records are committed.** It does not block the import.

The flow:
1. Steps 1-6 complete: approved records are in the DB, user sees their results.
2. If there are unresolved records (uncertain matches, contacts needing company verification), the system kicks off enrichment asynchronously.
3. User gets a notification when enrichment is done: "Enrichment complete — 147 records resolved. 12 still need your review."
4. User can then: approve enriched records, skip them, or dismiss.
5. There is also a toggle to skip enrichment entirely and just leave unresolved records as-is.

**Why async:** A 1,000-row import shouldn't wait 60 seconds for web scraping. The 850 clean records go in immediately. The 150 uncertain ones get enriched in the background. The user isn't stuck watching a progress bar.

### Three Enrichment Agents

**Agent 1: Domain Scraper (Spider.cloud + LLM)**
- Input: a domain like `acme.com`
- Action: Spider.cloud crawls the homepage + about page + contact page
- LLM extracts: canonical company name, industry, description, HQ location, social links, employee count indicators
- Output: structured company profile
- Use case: CSV has a domain or email (extract domain) but company name doesn't match DB

**Agent 2: LinkedIn Company Resolver (Harvest API)**
- Input: LinkedIn company URL (`linkedin.com/company/acme`)
- Action: Harvest API returns structured company data
- Output: canonical name, domain, industry, employee count, HQ, description
- Use case: CSV has LinkedIn company URL. Cross-reference with Agent 1 results if both ran.

**Agent 3: LinkedIn Person Resolver (Harvest API)**
- Input: LinkedIn person URL (`linkedin.com/in/johnsmith`)
- Action: Harvest API returns structured person data
- Output: full name, current title, current company name, current company LinkedIn URL, location
- Use case: CSV has person LinkedIn URL. Extracts current company reference → feeds into Agent 1 or 2 for company resolution.

### How Agents Chain Together

```
CSV row: { name: "John Smith", email: "john@acme.com" }
                                        |
                            Extract domain: acme.com
                                        |
                            Agent 1: Spider scrapes acme.com
                                        |
                            Result: {
                              name: "Acme Corporation",
                              industry: "SaaS",
                              linkedin: "linkedin.com/company/acme-corp"
                            }
                                        |
                Now match against DB with HIGH confidence
                because we have canonical name + domain + linkedin
```

```
CSV row: { name: "Jane Doe", company: "some startup", linkedin: "linkedin.com/in/janedoe" }
                                                                        |
                                                          Agent 3: Harvest API
                                                                        |
                                                          Result: {
                                                            title: "CTO",
                                                            company: "SomeStartup Inc",
                                                            companyLinkedin: "linkedin.com/company/somestartup"
                                                          }
                                                                        |
                                                          Agent 2: Harvest API
                                                                        |
                                                          Result: {
                                                            name: "SomeStartup Inc",
                                                            domain: "somestartup.io",
                                                            employees: 45
                                                          }
                                                                        |
                          Now we have domain, canonical name, linkedin, size
                          Match against DB with near-perfect confidence
```

### The LLM's Role

The LLM does **structured extraction from scraped HTML**, not matching. This is what LLMs excel at.

Prompt pattern:
```
Given the following scraped content from {url}, extract:
- Official company name (as it appears in their branding, not the domain)
- Industry/vertical
- Company description (1-2 sentences)
- Headquarters location
- Employee count or size indicator
- Any social media links found

Return as JSON. If a field cannot be determined, return null.
Do not guess or fabricate — only extract what is explicitly present.
```

Use a fast, cheap model (Haiku-tier). It's extraction, not reasoning. Runs at scale without cost concerns.

### Enrichment Efficiency

**Only enrich uncertain rows.** If 800 out of 1,000 rows resolved in Step 3, enrich only the remaining 200.

**Deduplicate enrichment calls.** If 50 contacts reference `@acme.com`, scrape `acme.com` ONCE. Collect unique domains + LinkedIn URLs, deduplicate, run agents in parallel.

**After enrichment, re-run matching.** The uncertain bucket shrinks dramatically. What was 200 "maybes" becomes 10-15 genuine ambiguities.

### Enrichment Cache

Every enrichment result gets persisted — not just for this import, but for all future operations:

```
enrichment_cache
  id
  lookup_type (domain | linkedin_company | linkedin_person)
  lookup_key (the URL or domain)
  raw_content (scraped HTML — stored for audit / re-extraction)
  extracted_data (JSONB — structured fields from LLM)
  model_used (which LLM extracted)
  confidence (LLM self-assessed extraction confidence)
  scraped_at
  expires_at (TTL — stale after 30-60 days)
  scrape_source (spider | harvest | custom)
```

Benefits:
- First import with 500 @acme.com contacts → scrape once, cache
- Next import with more Acme contacts → cache hit, zero scraping
- Company records can display enriched data (industry, size, description) from cache
- Stale data (>30 days) → re-scrape on next import referencing it

### Cost (Validated)

- **Spider.cloud:** ~$0.001-0.002 per scrape (confirmed via live testing)
- **Harvest API:** pay-as-you-go per lookup (exact per-call cost TBD — not in docs, check dashboard after first calls)
- **LLM extraction (Haiku-tier):** ~$0.001 per call for markdown → structured JSON
- **Example: 1,000-contact import referencing 200 unique companies:**
  - 200 Spider scrapes (3 pages each = 600 fetches) → ~$0.60-1.20
  - 200 Harvest company lookups → TBD (estimate $5-20 based on typical LinkedIn API pricing)
  - ~50 Harvest person lookups (only for uncertain contacts with LinkedIn URLs) → TBD
  - 200 LLM extraction calls → ~$0.20
  - **Estimated total: $6-22 per 1,000-contact import** (dominated by Harvest API costs)
  - With caching: second import touching same companies → near-zero incremental cost

### Future Providers

Because the enrichment pipeline is pluggable, adding new sources changes nothing about the matching engine:
- **Whop internal data**: if a seller is on Whop's platform, pull their profile as enrichment
- **Google search**: for companies with no domain or LinkedIn
- **Social media scraping**: Twitter/X profiles for additional signals
- **Any future internal API**

Each provider implements the same interface. The matching engine uses whatever fields are available.

---

## Step 5: Preview (The Gate)

Nothing touches the database until the user sees and confirms:

```
Import Summary
------------------------------------
READY TO IMPORT:
  Contacts:
    150 new contacts to create
     45 existing contacts to update
  Companies:
     8 new companies to create
    22 contacts linked to existing companies

NEEDS YOUR REVIEW:
    12 possible contact matches (side-by-side)
     2 company matches (side-by-side)

HELD FOR ENRICHMENT (post-import):
    37 contacts with uncertain company matches
     → Will run LinkedIn/domain enrichment after import
     → You'll be notified when ready to review

REJECTED:
     3 rows with validation errors (download report)

UNLINKED:
     5 contacts with no company info (will be flagged)
------------------------------------
```

The user can:
- Review each uncertain match (side-by-side comparison of import row vs existing record)
- Download validation errors to fix and re-import
- See exactly which existing records will be updated and what fields change
- Approve or cancel the entire import

**There is no "skip review" button.** The preview IS the import process. If there are items needing review, the user must address them before proceeding. Admins can build their own backdoor if they need to bypass this for trusted sources — but the default protects all users.

### Batched Review UX

When there are review items, group them intelligently:
- "These 15 contacts all reference 'Acme' — we found 'Acme Corp' and 'Acme Solutions' in your DB. Which one?" → One decision resolves 15 rows.
- "These 8 contacts match existing records by name but have different emails. Update or create new?" → Batch decision.

This turns 23 review items into 3-4 decisions.

---

## Step 6: Atomic Commit

Once approved:
- Process approved records in batches with database savepoints
- If batch N fails → roll back batch N only, commit everything else
- Failed batches can be retried after fixing
- Records held for enrichment are NOT committed yet — they stay in staging

**For updates/merges — field-level survivorship rules:**

| Field | Default Strategy | Rationale |
|-------|-----------------|-----------|
| email | ADDITIVE — add as additional email, don't overwrite | People have multiple emails. Never remove contact data. |
| phone | ADDITIVE — add as additional phone | Same person, multiple numbers. |
| first_name | Most complete (longest) | "Robert" beats "Bob" for canonical |
| last_name | Keep existing (CRM > import) | Existing record more likely correct |
| job_title | Import wins (most recent) | Titles change with promotions |
| company link | See "Contact-Company Change Detection" above | Company email is the deciding factor |
| address | Import wins (most recent) | Addresses change |

These are configurable by admins in Settings.

**Full audit trail:**
- Every field change logged: old value, new value, source (import job ID), timestamp
- Raw import data preserved permanently in staging table
- Every matching decision logged: which candidates were compared, what scores they got, what decision was made

---

## Step 8: Post-Commit Verification

After commit:
- Verify no orphaned contacts were created (every contact has a company or is explicitly flagged)
- Verify no duplicate companies were created
- Verify referential integrity intact
- Show final report with full statistics
- Create notification alert for the user
- If enrichment records exist → kick off async enrichment (Step 7) and notify user when complete

---

## Data Model

### Core Import Tables

```
import_jobs
  id
  status (pending | normalizing | matching | enriching | preview | confirmed | committing | complete | failed | cancelled)
  entity_type (contact | company)
  created_by (user FK)
  file_name
  file_metadata (JSONB: encoding, delimiter, row_count, column_mapping)
  raw_row_count (rows in original file)
  deduped_row_count (after intra-file dedup)
  quality_score (0-100, computed after Step 3)
  statistics (JSONB: new_count, update_count, merge_count, reject_count, enrichment_count)
  created_at
  completed_at

import_staging_rows
  id
  import_job_id (FK)
  row_number (position in original file)
  raw_data (JSONB — original values exactly as received, never modified)
  normalized_data (JSONB — after normalization pipeline)
  validation_status (passed | failed_fixable | failed_blocked)
  validation_errors (JSONB array: [{field, error_type, message}])
  entity_resolution (JSONB: {
    status: new | matched | uncertain | enrichment_needed,
    matched_record_id: uuid | null,
    match_confidence: 0.0-1.0,
    match_tier: email | phone | name_company | name_only | none,
    candidates: [{record_id, confidence, field_scores}]
  })
  company_resolution (JSONB: {
    status: linked | will_create | uncertain | unlinked,
    company_id: uuid | null,
    company_name_from_csv: string,
    match_confidence: 0.0-1.0,
    enrichment_data: {} | null
  })
  user_decision (approve | reject | merge_with:{id} | create_new | null)
  committed (boolean, default false)

import_batches
  id
  import_job_id (FK)
  batch_number
  row_start
  row_end
  status (pending | committed | failed | rolled_back)
  error_message
  committed_at

enrichment_cache
  id
  lookup_type (domain | linkedin_company | linkedin_person)
  lookup_key (URL or domain, unique)
  raw_content (text — scraped HTML, stored for audit)
  extracted_data (JSONB — structured fields from LLM)
  model_used
  confidence
  scrape_source (spider | harvest)
  scraped_at
  expires_at
```

---

## Multi-Value Contact Fields

Contacts are not single-email, single-phone entities. Real people have:
- Multiple personal emails
- Multiple company emails (current + past employers)
- Multiple phone numbers (personal, work, mobile)

**The system never removes contact data.** Imports are ADDITIVE for contact fields like email and phone. When an import row has an email that differs from the existing record, both are kept.

**Starring / Primary designation:**
- Each email and phone has an `is_primary` flag
- The Whop employee (account manager) can star which email/phone is the most reliable and up-to-date for outreach
- Default: the most recently added value from the highest-trust source becomes primary
- The user can always override

**Data model implication:**
```
contact_emails
  id
  contact_id (FK)
  email (normalized)
  email_type (work | personal | other)
  is_primary (boolean)
  source (manual | import | enrichment)
  source_id (import_job_id, etc.)
  added_at
  verified_at (null until verified)

contact_phones
  id
  contact_id (FK)
  phone (E.164 normalized)
  phone_type (work | personal | mobile | other)
  is_primary (boolean)
  source (manual | import | enrichment)
  source_id
  added_at
```

This means dedup matching checks ALL emails and ALL phones for a contact, not just one. If any email on an existing contact matches an import row's email → it's the same person.

---

## Key Design Principles

1. **Resolve companies before contacts.** Always. Companies are the anchor.

2. **Normalize before matching.** Every comparison happens on normalized values. Raw data stored for audit only.

3. **Three-way decisions, never binary.** Every match is yes, maybe, or no. "Maybe" gets enrichment first, then user review only if still uncertain.

4. **Enrichment runs async, post-commit.** Approved records commit immediately. Uncertain records get enriched in the background. The import is never blocked by scraping.

5. **The preview IS the product.** The import wizard's value is showing the user exactly what will happen and letting them control it.

6. **No silent side effects.** If a contact import creates a company, the user knows. If a contact is unlinked, the user knows. Nothing happens without explicit approval.

7. **Block bad imports, don't bandage them.** If the file is too messy, refuse it with a clear explanation. A rejected import is better than 500 orphaned contacts.

8. **Own the enrichment stack.** Spider.cloud for web scraping, Harvest API for LinkedIn, LLM for extraction. No vendor lock-in. Costs almost nothing. Gets smarter as cache grows.

9. **Never delete contact data.** Emails, phones, company associations are additive. People have multiple identities. The user decides what's primary.

10. **Company email is the deciding factor for identity.** New company email = new professional identity = new record. Same company email = same person = update. No company email + different company name = uncertain = enrich or review.

11. **Cache everything.** Enrichment results, matching decisions, raw data. The system compounds — every import makes the next one better.

12. **Audit trail is non-negotiable.** Every decision traceable: what matched, what scores, what the user approved, what fields changed, what the old values were.

---

## Implementation Notes (Reference for Future Sessions)

### Spider.cloud Integration (Agent 1: Domain Scraper)

**MCP Tools Available:** `spider_scrape` (single URL), `spider_crawl` (multi-page), `spider_search` (search)

**Tested Response Structure:**
```json
{
  "results": [{
    "content": "string (markdown/html/text — full page content)",
    "costs": {
      "total_cost": 0.001,        // ~$0.001-0.002 per scrape
      "ai_cost": 0,
      "bytes_transferred_cost": 0.0003,
      "compute_cost": 0.0005,
      "file_cost": 0,
      "transform_cost": 0.0002
    },
    "duration_elasped_ms": 1500,  // ~1.5-2 seconds per scrape
    "error": null,
    "metadata": {
      "description": "string",   // Often contains a usable company description directly from meta tags
      "domain": "string",
      "title": "string",
      "og_image": "string",
      "keywords": ["string"],
      "file_size": 14000,
      "final_url": "string",     // IMPORTANT: captures redirects (e.g., stripe.com → stripe.com/en-de)
      "pathname": "string"
    },
    "status": 200,
    "url": "string"
  }],
  "count": 1,
  "success": true
}
```

**Implementation Details:**
- Scrape up to 3 pages per domain: homepage, /about, /contact
- `metadata.description` is a quick win — often contains a good company description without needing LLM extraction
- `final_url` must be checked against the original URL — Spider follows redirects (locale redirects are common)
- **Locale redirect issue discovered:** stripe.com redirected to stripe.com/en-de (German). stripe.com/about redirected to stripe.com/de. **Mitigation:** Pass `Accept-Language: en-US` header if Spider supports it, or append `?hl=en` / use `.com/en/` paths. Validate returned content language before LLM extraction.
- Content returned as markdown (~14KB for a typical corporate homepage) — suitable for direct LLM ingestion
- Cost is negligible: 200 domain scrapes ≈ $0.20-0.40

**Storage Decision:**
- Store raw markdown content in `enrichment_cache.raw_content` (TEXT column, not object storage)
- Typical page is 10-20KB markdown — 10,000 cached pages ≈ 150MB, well within DB comfort zone
- Compress only if cache exceeds 1GB (revisit at that point)
- Raw content enables re-extraction with improved prompts without re-scraping

### Harvest API Integration (harvest-api.com)

**Base URL:** `https://api.harvest-api.com`
**Auth:** API key via `X-API-Key` header
**Pricing:** Pay-as-you-go (no subscription)

#### Agent 2: GET /linkedin/company

Retrieves full LinkedIn company profile.

**Query Parameters (at least one required):**
| Param | Description |
|-------|-------------|
| `url` | LinkedIn company URL (e.g., `https://linkedin.com/company/google/`) |
| `universalName` | Company's universal name from LinkedIn URL slug |
| `search` | Company name for LinkedIn search lookup |

**Response — key fields we extract:**
```json
{
  "element": {
    "id": "string",
    "universalName": "string",
    "name": "string",                    // Canonical company name
    "tagline": "string",
    "website": "string",                 // Company domain — critical for matching
    "linkedinUrl": "string",
    "description": "string",             // Company description
    "employeeCount": 1234,               // Exact employee count
    "employeeCountRange": { "start": 1001, "end": 5000 },
    "followerCount": 50000,
    "industries": ["string"],            // Industry classification
    "specialities": ["string"],
    "foundedOn": { "year": 2010 },
    "headquarter": {
      "city": "string",
      "geographicArea": "string",        // State/region
      "country": "string",
      "parsed": {
        "countryCode": "US",
        "state": "California",
        "city": "San Francisco"
      }
    },
    "locations": [{ "city": "string", "country": "string", "headquarter": true }],
    "logo": "string",
    "phone": "string|null",
    "active": true,
    "pageVerified": true,
    "crunchbaseFundingData": {           // Funding info if available
      "numberOfFundingRounds": 3,
      "lastFundingRound": {
        "localizedFundingType": "Series C",
        "moneyRaised": { "amount": "50000000", "currencyCode": "USD" }
      }
    }
  },
  "status": "string",
  "error": "string"
}
```

**What we cache from this response:**
- `name` → canonical company name
- `website` → domain (critical for DB matching)
- `description`, `industries`, `specialities` → company profile enrichment
- `employeeCount` / `employeeCountRange` → company size
- `headquarter.parsed` → structured location
- `linkedinUrl` → LinkedIn URL for future lookups

#### Agent 3: GET /linkedin/profile

Retrieves full LinkedIn person profile.

**Query Parameters (at least one required):**
| Param | Description |
|-------|-------------|
| `url` | LinkedIn profile URL |
| `publicIdentifier` | Public ID from URL slug (e.g., `williamhgates`) |
| `profileId` | LinkedIn internal profile ID |
| `findEmail` | Find and verify the person's email (SMTP verification) |
| `skipSmtp` | Skip SMTP verification (faster, less accurate) |

**Response — key fields we extract:**
```json
{
  "element": {
    "publicIdentifier": "string",
    "firstName": "string",
    "lastName": "string",
    "headline": "string",               // Current title/headline
    "about": "string",
    "linkedinUrl": "string",
    "photo": "string",
    "location": {
      "parsed": {
        "countryCode": "US",
        "state": "Washington",
        "city": "Seattle"
      }
    },
    "currentPosition": [{
      "companyName": "string"            // CRITICAL — current company name
    }],
    "experience": [{
      "companyName": "string",
      "position": "string",             // Job title
      "companyLink": "string",          // LinkedIn company URL — feeds into Agent 2
      "employmentType": "string",
      "startDate": { "year": 2020, "month": "Jan" },
      "endDate": { "year": null }       // null = current position
    }],
    "skills": [{ "name": "string" }],
    "education": [{ "title": "string", "degree": "string" }]
  },
  "status": "string"
}
```

**What we extract for import resolution:**
- `currentPosition[0].companyName` → current company (for contact-company linking)
- `experience[0].companyLink` → LinkedIn company URL → feeds into Agent 2 for full company data
- `experience[0].position` → current job title (survivorship: import wins for title)
- `firstName`, `lastName` → name verification against import row
- `location.parsed` → location data

**Agent chaining flow:**
1. Agent 3 returns person profile with `experience[0].companyLink = "linkedin.com/company/acme-corp"`
2. Agent 2 fetches that company URL → returns `website: "acme.com"`, `name: "Acme Corporation"`
3. Now we have domain + canonical name + LinkedIn URL for the company → high-confidence DB match

#### Supplementary: GET /linkedin/company-search

Useful when we have a company name but no URL or domain.

**Parameters:** `search` (keyword), `location`, `companySize` (1-10, 11-50, 51-200, etc.), `industryId`, `page`

**Response:**
```json
{
  "elements": [{
    "id": "string",
    "name": "string",
    "industries": "string",
    "location": { "linkedinText": "string" },
    "followers": "string",
    "summary": "string",
    "logo": "string",
    "linkedinUrl": "string",
    "universalName": "string"
  }],
  "pagination": { "totalElements": 50, "pageNumber": 1, "pageSize": 10 }
}
```

**Use case:** CSV has company name "Acme" but no domain/LinkedIn URL. Search LinkedIn for "Acme", get top results, use `universalName` to fetch full profile via Agent 2, extract domain, match against DB.

#### Rate Limiting & Error Handling
- **Auth errors:** 401 → invalid API key. Surface to admin, halt enrichment.
- **Not found:** 200 with `element: null` or empty — record genuinely not on LinkedIn. Cache as "not found" to avoid re-lookups.
- **Rate limits:** Not documented. Implement exponential backoff (1s, 2s, 4s, 8s, max 30s). Set concurrency limit of 5 parallel requests per enrichment batch.
- **Timeouts:** Set 15s timeout per request. On timeout, retry once, then mark as "enrichment_failed" and skip.
- **Cost tracking:** Log every API call with cost (if returned) in `enrichment_cache`. Aggregate per import job for visibility.

### Enrichment Budget & Rate Limiting
- Enrichment should have configurable concurrency limits per import
- Budget cap per import (e.g., max 500 enrichment lookups) to prevent runaway costs
- Queue excess lookups for background processing
- All costs tracked per import job for visibility
