# Whop CRM: Data Integrity & Import Architecture Plan

> **Status:** Research complete. Proposal for review.
> **Date:** 2026-03-07
> **Research scope:** Attio, Day.ai, HubSpot, Salesforce, Clay architectures; Fellegi-Sunter probabilistic record linkage; Splink, Zingg, Dedupe.io open-source tools; DAMA-DMBOK MDM framework; 30+ documented CRM failure modes; event sourcing & CQRS patterns; staging/quarantine architectures; data validation pipeline patterns from Great Expectations, Soda, dbt.

---

## Part 1: The Problem — Why CRM Data Integrity Is So Hard

### The Numbers That Should Scare You

| Fact | Source |
|------|--------|
| Dirty data costs companies **$15M/year** on average | Gartner |
| Bad data costs the US economy **$3T/year** | Harvard Business Review |
| **44%** of companies lose >10% annual revenue to poor CRM data | Clari |
| B2B contact data decays at **2.1% per month** (22.5%/year) | HubSpot |
| **50%** of worker time is spent finding/correcting bad data | Industry surveys |
| Clean CRM data = **up to 70% higher conversion rates** | Insycle |
| Prevention costs **$1/record**. Cleanup costs **$10**. Failure costs **$100** | 1-10-100 Rule |

### The 30 Ways CRM Data Gets Corrupted

From our research, we identified 30 distinct failure modes organized into 7 categories:

**A. Duplicate Records (the #1 problem)**
1. Exact duplicates from re-imports and form resubmissions
2. Fuzzy duplicates from spelling variations, abbreviations, typos
3. Cross-object duplicates (same person as Lead AND Contact)
4. Multi-source duplicates (marketing list + trade show + web form = 3 records for 1 person)

**B. Formatting Inconsistencies**
5. Phone formats: `(415) 555-1234` vs `+14155551234` vs `415.555.1234`
6. Address chaos: "Street" vs "St" vs "St.", "Suite" vs "Ste" vs "#"
7. Name parsing: "Dr. Stephen Vincent Strange" → First: "Dr.", Last: "Stephen"
8. Date ambiguity: `05/04/2024` — May 4 or April 5?
9. Company name variations: "Acme" vs "Acme Inc" vs "Acme, Inc." vs "ACME LLC"
10. Picklist mismatches: "USA" vs "United States" vs "US"

**C. Missing & Incomplete Data**
11. Required fields left empty (contacts without email)
12. Skeleton records from integrations that sync partial data
13. Placeholder/junk values: "N/A", "test", "asdf", ".", " "

**D. Stale & Outdated Data**
14. Natural decay: 30% of workers change jobs annually
15. Logical decay: zero-engagement leads still marked "hot"
16. Regulatory decay: GDPR requests not processed

**E. Orphaned & Broken Relationships**
17. Contacts without company associations
18. Deals without contacts
19. Activities pointing to deleted/merged records
20. Broken parent-child company hierarchies

**F. Import-Specific Corruption**
21. Excel auto-formatting destruction (leading zeros stripped, dates mangled, scientific notation, 15-digit precision limit, type inference from first 200 rows only)
22. Character encoding corruption (UTF-8 vs Latin-1 = mojibake)
23. Column mapping errors (phone in email field)
24. Delimiter confusion (commas in company names break CSV)
25. Row truncation (Excel's 1M row limit silently drops data)
26. Relational data flattened into rows (company name as text, not foreign key)
27. BOM (Byte Order Mark) invisible bytes breaking parsers
28. Hidden whitespace (non-breaking spaces U+00A0, zero-width chars, trailing spaces) that look identical but fail all string comparisons

**G. Systemic Degradation**
28. Multi-user import storms (different teams, different sources, no coordination)
30. API-created records bypassing dedup entirely (HubSpot's known flaw)
31. No system-of-record defined — conflicting data across tools with no survivorship rules
32. Concurrent update conflicts — two reps update the same record, last-write-wins destroys the first change
33. Integration sync drift — field mappings change in one system but not the other, data flows into wrong fields

### The Degradation Cascade (How It Compounds Over Time)

This is the most insidious pattern. Individual imports can each be "pretty clean," but the cumulative effect is devastating:

```
Month 0:  Marketing imports 5,000 contacts (~95% clean)
Month 2:  Sales imports 2,000 from trade show → 200 near-duplicates created
Month 4:  Marketing automation syncs bidirectionally → picklist mismatches, sync loops
Month 6:  Partner shares 3,000 leads → 500 duplicates, 200 orphaned contacts
Month 12: 22.5% of original data has decayed. Nobody knows which system is truth.
          Sales reps maintain personal spreadsheets. Reports are unreliable.
          Leadership loses confidence in the CRM.
```

**This is what we must prevent.**

---

## Part 2: How The Best CRMs Handle It (And Where They Fall Short)

### Attio
- **Dedup:** Email canonicalization (strips dots, plus-addressing), domain redirect detection via HTTP, social handle matching, phone normalization. Webhook-based real-time detection (10-20 seconds).
- **Merge:** Right-side priority. Combines lists, notes, tasks, comments, emails. Limited to People and Companies only.
- **Weakness:** No fuzzy name matching. Canonicalization + exact match only. Can't merge Deals or custom objects.

### Day.ai (Most Architecturally Sophisticated)
- **Architecture:** CQRS with EAV (Entity-Attribute-Value) write store + Materialize streaming SQL for read views.
- **Key insight:** Every enrichment, override, inference, and human correction becomes a separate row. A single field might have 8 rows from different sources. The read path reconciles via business rules and maintains full value history.
- **Dedup:** AI-powered from conversation scanning (email, Slack). Graph-based relationship modeling.
- **This is the pattern worth studying most deeply.**

### HubSpot
- **Dedup:** Email-only exact match for contacts. Domain for companies. Recently added custom dedup rules with fuzzy option.
- **Weakness:** API-created companies bypass domain dedup entirely. 5K-10K duplicate pair limits. No fuzzy by default. Daily batch recalculation (not real-time).

### Salesforce
- **Dedup:** Matching Rules + Duplicate Rules. Fuzzy matching via Levenshtein distance. Match keys for performance.
- **Weakness:** Max 5 duplicate rules per object. Native merge handles only 3 records at a time. Create-only detection — doesn't scan existing data. Only in Unlimited/Performance editions.

### Clay
- **Enrichment:** Waterfall through 150+ providers sequentially. 80%+ match rates vs 40-50% single-source.
- **Dedup:** Exact string match only. AI Duplicate Resolver for cross-platform fuzzy matching.
- **Weakness:** Basic dedup. The waterfall enrichment is the star, not the dedup.

### The Universal Gaps (Across ALL 6 CRMs Studied)

Every CRM we studied has the same fundamental gaps:
1. **No CRM has true import rollback.** Every single one requires manual cleanup after a bad import. This is a massive gap and competitive advantage opportunity.
2. **Merge is always destructive and irreversible.** No CRM stores a pre-merge snapshot that can be restored.
3. **No CRM except Day.ai preserves full data provenance** — knowing WHY a field has a particular value and where it came from is lost after merge in all traditional CRMs.
4. **API/integration paths bypass dedup.** Only UI and import paths get checked (Salesforce, HubSpot both suffer from this).
5. **Fuzzy matching is either absent or primitive.** Nobody uses probabilistic record linkage (Fellegi-Sunter). Salesforce uses Levenshtein but with no field weighting. Attio uses only exact-after-normalization.
6. **Survivorship rules are simplistic.** "Right side wins" (Attio) or "last write wins" — no field-level configurable strategies. Only HubSpot has some smart exceptions (sum conversions, keep furthest lifecycle stage).
7. **No staging/quarantine for imports.** Data goes straight into production in every CRM.
8. **Bulk merge is severely limited.** Salesforce: max 3 at a time. Attio: no bulk merge at all.
9. **Company dedup is universally harder** than contact dedup. Domain matching helps but fails for companies without websites, or with multiple domains, or domain variations (.co.uk vs .com).

---

## Part 3: The Science — Entity Resolution Done Right

### The Fellegi-Sunter Model (Gold Standard Since 1969)

This is the mathematically optimal framework for probabilistic record linkage, used by Splink (UK government, processing millions of records), and validated across decades of academic research.

**Core concept:** For each pair of records, compute a match probability by combining evidence from individual field comparisons.

**Three parameters:**
- **λ (lambda):** Prior probability that any two random records match
- **m probability:** P(field values agree | records ARE a match) — measures data quality
- **u probability:** P(field values agree | records are NOT a match) — measures coincidence

**Match weight per field:** `w = log₂(m / u)`

- If email matches: m=0.95 (true matches share email 95% of the time), u=0.0001 (random records share email 0.01% of the time) → weight = +13.2 (very strong evidence)
- If city matches: m=0.85, u=0.15 → weight = +2.5 (weak evidence)
- If last name disagrees: m=0.05, u=0.95 → weight = -4.2 (evidence against)

**Final match probability:**
```
Total weight = prior_weight + w_email + w_name + w_phone + w_company + ...
Probability = 2^(total_weight) / (1 + 2^(total_weight))
```

Weight of 0 = 50% probability. Weight of 4 = 95%. Weight of 7 = 99%.

**Why this matters:** Instead of binary "match/no match," you get a calibrated probability. This enables the three-zone decision system:
- **>90% → Auto-merge** (high confidence)
- **70-89% → Human review** (uncertain)
- **<70% → Auto-reject** (not a match)

### String Similarity — Which Algorithms For Which Fields

| Field Type | Best Algorithm | Why |
|-----------|---------------|-----|
| Person names | **Jaro-Winkler** | Weights prefix matches heavily (fewer errors at start of names). ≥0.9 catches typos, ≥0.8 adds nicknames. |
| Company names | **SoftTFIDF** (hybrid of TFIDF + Jaro-Winkler) | Handles token reordering ("International Business Machines" vs "IBM Corp"). Outperforms all pure metrics in benchmarks. |
| Email addresses | **Exact match after canonicalization** | Strip dots, normalize plus-addressing, lowercase. Then exact compare. |
| Phone numbers | **Exact match after E.164 normalization** | Use libphonenumber to normalize to +{country}{number}. Then exact compare. |
| Addresses | **Token-level Jaccard + Levenshtein** | Handle abbreviations (St/Street) and token reordering. |
| Short identifiers | **Levenshtein/Damerau-Levenshtein** | Good for IDs, codes, short strings where transpositions matter. |

**Best practice from research:** Use multiple comparison levels hierarchically per field — exact match (highest weight), Jaro-Winkler ≥0.9, Jaro-Winkler ≥0.8, phonetic match, else. The Fellegi-Sunter model assigns appropriate weights to each level.

### Blocking Strategies (Solving the O(n²) Problem)

You cannot compare every record to every other record. With 50,000 contacts, that's 1.25 billion comparisons. Blocking reduces this to a tractable number.

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **Standard blocking** | Group by exact key (e.g., first 3 chars of last name + zip) | Fast, simple, but misses typos in the blocking key |
| **Sorted neighborhood** | Sort by key, compare within sliding window of size w | Handles some typos. Proven at scale. |
| **Phonetic blocking** | Block on Soundex/Metaphone encoding | Catches spelling variations of names |
| **Multi-pass blocking** | Run multiple blocking passes with different keys | Higher recall — combines email domain block + name phonetic block + phone prefix block |
| **LSH (Locality Sensitive Hashing)** | Similar items hash to same bucket with high probability | Best recall-at-scale tradeoff |

**Recommendation for Whop CRM:** Use multi-pass blocking with 3-4 blocking keys run in parallel:
1. Email domain block
2. First 3 chars of normalized last name + first initial
3. Phone number (last 7 digits)
4. Company domain

### Company Name Resolution — The Hard Problem

"IBM" vs "International Business Machines" vs "IBM Corporation" vs "IBM Corp."

**7-step normalization pipeline:**
1. Remove legal suffixes (Inc, Corp, LLC, Ltd, GmbH, AG, SA, Pty Ltd) → store in separate field
2. Standardize capitalization (Title Case default, exception list for eBay, iPhone, IBM, AT&T)
3. Handle punctuation (remove periods from abbreviations, standardize & vs "and")
4. Normalize abbreviations (Intl → International, Mfg → Manufacturing, but keep known brands)
5. Resolve parent/subsidiary (decide: normalize to parent or preserve distinctions)
6. Strip geographic qualifiers ("Google UK Limited" → "Google" or keep separate)
7. Remove leading "The" ("The Coca-Cola Company" → "Coca-Cola")

**Critical: Alias/Synonym Tables.** No string similarity algorithm can match "IBM" to "International Business Machines." You need a canonical name reference table:

```
alias                          → canonical_name
IBM                            → International Business Machines
IBM Corp                       → International Business Machines
Big Blue                       → International Business Machines
```

This table should be: manually curated for top accounts, bootstrapped from commercial data (Clearbit, D&B), and augmented with LLM-assisted suggestions for new entries. Domain matching (`@ibm.com`) serves as a strong supplementary signal regardless of name field.

**Frequency-aware scoring.** The standard Fellegi-Sunter model treats all value agreements equally. But agreement on a rare company name like "Brzezinski Consulting" is far stronger evidence than agreement on "Smith Corp." Frequency-aware extensions compute term-specific m/u probabilities — Splink supports this natively via term frequency adjustments.

### Golden Record / Survivorship Strategies

When merging duplicates, which field values survive? **This must be configured per field, not per record.**

| Strategy | Best For | Example |
|----------|---------|---------|
| **Source priority** | Fields where one system is authoritative | CRM owns "Account Owner," ERP owns "Billing Address" |
| **Most recent** | Volatile fields that change frequently | Email, phone, job title, company. **Caveat:** requires reliable timestamps — batch sync jobs can overwrite good data with stale data if timestamps reflect sync time rather than actual change time. Always store business timestamp separately from system timestamp. |
| **Most complete** | Fields where more detail is better | Full name vs abbreviated, complete address vs partial |
| **Frequency-based** | When multiple sources conflict | Company name appearing most often across sources |
| **Longest value** | Descriptive fields | Bio, notes, address |
| **Manual review** | High-value accounts, ambiguous cases | Always for key accounts |

---

## Part 4: The Architecture — What We Should Build

### Core Principle: Data Never Goes Directly Into Production

Every piece of data — whether from CSV import, API call, manual entry, or integration — must pass through the same validation pipeline before touching the canonical tables. No exceptions. No shortcuts. No "bypass for API calls" (HubSpot's fatal flaw).

### The Import Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA ENTRY POINTS                           │
│   CSV Import  │  Manual Entry  │  API Call  │  Integration Sync    │
└───────┬───────┴───────┬────────┴─────┬──────┴──────────┬───────────┘
        │               │              │                 │
        ▼               ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: RAW INGESTION                          │
│                                                                     │
│  • Store raw data in import_staging table (never modified)          │
│  • Capture: source, timestamp, raw values, file encoding           │
│  • Assign import_job_id for tracking                               │
│  • This is your debugging lifeline — always keep the original      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STAGE 2: PARSING & NORMALIZATION                  │
│                                                                     │
│  For each row:                                                      │
│  • Detect & fix encoding (UTF-8 normalization)                     │
│  • Parse names (handle prefixes, suffixes, compound names)         │
│  • Normalize phones to E.164 (via libphonenumber logic)            │
│  • Normalize emails (lowercase, strip dots in gmail, etc.)         │
│  • Normalize company names (7-step pipeline)                       │
│  • Normalize dates to ISO 8601                                     │
│  • Detect and flag junk values ("N/A", "test", ".", " ")           │
│  • Strip invisible characters (non-breaking spaces U+00A0,        │
│    zero-width chars, BOM bytes, soft hyphens)                      │
│  • Trim all whitespace (leading, trailing, collapse internal)      │
│  • Validate field types (email regex, phone format, URL format)    │
│                                                                     │
│  Output: normalized_staging rows with normalization_log             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   STAGE 3: ENTITY RESOLUTION                       │
│                                                                     │
│  For each normalized row, find potential matches in existing data:  │
│                                                                     │
│  Step 1: BLOCKING                                                   │
│  • Multi-pass blocking (email domain, name phonetic, phone suffix, │
│    company domain) to generate candidate pairs                      │
│                                                                     │
│  Step 2: COMPARISON                                                 │
│  • For each candidate pair, compute field-level similarities:       │
│    - Email: exact match after canonicalization                      │
│    - Name: Jaro-Winkler at multiple thresholds                     │
│    - Phone: exact match after E.164 normalization                  │
│    - Company: SoftTFIDF with normalized names                      │
│    - Domain: exact match with redirect resolution                  │
│                                                                     │
│  Step 3: SCORING (Fellegi-Sunter)                                   │
│  • Compute match weight per field pair using m/u probabilities     │
│  • Sum weights → convert to match probability                      │
│                                                                     │
│  Step 4: DECISION                                                   │
│  • >90% confidence → auto-merge (apply survivorship rules)         │
│  • 70-89% confidence → queue for human review                      │
│  • <70% confidence → treat as new record                           │
│                                                                     │
│  Output: resolution_decisions with match_probability per pair       │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: VALIDATION GATE                        │
│                                                                     │
│  Quality checks before any data touches production:                 │
│                                                                     │
│  • Completeness: required fields populated?                        │
│  • Referential integrity: company exists? pipeline stage valid?     │
│  • Business rules: deal amount positive? close date logical?       │
│  • Email deliverability: valid syntax? not disposable? not role?   │
│  • Duplicate check WITHIN the import batch (intra-file dedup)      │
│                                                                     │
│  Each row gets a validation_status:                                 │
│  • PASSED — ready for production                                    │
│  • FAILED_FIXABLE — has issues that can be auto-corrected          │
│  • FAILED_BLOCKED — requires human intervention                    │
│  • REVIEW_NEEDED — entity resolution match needs human decision    │
│                                                                     │
│  Output: validated rows + validation_report for the import job     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                STAGE 5: PREVIEW & USER CONFIRMATION                │
│                                                                     │
│  Before committing, show the user:                                  │
│  • Summary: X new records, Y updates, Z merges, W rejected        │
│  • Validation report: what failed and why                          │
│  • Side-by-side merge previews for matches >70%                    │
│  • Downloadable report of rejected/quarantined rows                │
│                                                                     │
│  User actions:                                                      │
│  • Approve all (within their confidence threshold)                 │
│  • Review individual merge decisions                               │
│  • Fix rejected rows and re-submit                                 │
│  • Cancel entire import                                            │
│                                                                     │
│  NOTHING touches production until explicit user confirmation.       │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STAGE 6: ATOMIC COMMIT                             │
│                                                                     │
│  Process approved rows in batches with database savepoints:        │
│                                                                     │
│  • Batch size: 100-500 rows per transaction                        │
│  • On failure: rollback to savepoint, mark batch as failed         │
│  • Successful batches are committed and logged                     │
│  • Failed batches can be retried after fixing                      │
│  • Full audit trail: import_job → batch → row → field changes     │
│                                                                     │
│  For merges, apply survivorship rules per field:                   │
│  • Email: source priority (CRM > import)                          │
│  • Phone: most recent                                              │
│  • Name: most complete                                             │
│  • Company: source priority                                        │
│  • Custom fields: configurable per field                           │
│                                                                     │
│  Output: committed changes + change_history entries                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               STAGE 7: POST-COMMIT VERIFICATION                    │
│                                                                     │
│  After commit, verify data integrity:                              │
│                                                                     │
│  • No orphaned contacts (every contact has a company or is flagged)│
│  • No orphaned deals (every deal has a contact)                    │
│  • Referential integrity intact                                    │
│  • Import job marked complete with statistics                      │
│  • Notification to user with import summary                        │
│                                                                     │
│  Store permanently:                                                 │
│  • Raw import data (import_staging — never delete)                 │
│  • Normalization decisions and logs                                │
│  • Entity resolution scores and decisions                          │
│  • Validation results                                              │
│  • Survivorship rule applications                                  │
│  • Change history for every field modified                         │
└─────────────────────────────────────────────────────────────────────┘
```

### The Data Model (Key Tables)

```
import_jobs
├── id, status (pending/processing/preview/confirmed/committed/failed/cancelled)
├── source_type (csv/api/manual/integration)
├── created_by, created_at
├── file_metadata (encoding, delimiter, row_count, column_mapping)
├── statistics (new_count, update_count, merge_count, reject_count)
└── completed_at

import_staging_rows
├── id, import_job_id
├── row_number (position in original file)
├── raw_data (JSONB — original values exactly as received)
├── normalized_data (JSONB — after normalization pipeline)
├── validation_status (passed/failed_fixable/failed_blocked/review_needed)
├── validation_errors (JSONB array of {field, error_type, message})
├── resolution_status (new/match_found/auto_merged/review_queued)
├── matched_record_id (FK to existing record if match found)
├── match_confidence (0.0-1.0)
├── match_details (JSONB — per-field scores and weights)
└── user_decision (approve/reject/merge/skip — set during preview)

import_batches
├── id, import_job_id
├── batch_number, row_start, row_end
├── status (pending/processing/committed/failed/rolled_back)
├── error_message (if failed)
└── committed_at

entity_resolution_log
├── id, import_staging_row_id
├── candidate_record_id
├── match_probability
├── field_scores (JSONB — {email: 0.95, name: 0.82, phone: 1.0, ...})
├── decision (auto_merge/review/reject)
├── decided_by (system/user_id)
└── decided_at

survivorship_rules
├── id, entity_type (contact/company/deal)
├── field_name
├── strategy (source_priority/most_recent/most_complete/frequency/longest/manual)
├── priority_config (JSONB — source rankings, etc.)
└── is_active
```

### The EAV Value History Pattern (Inspired by Day.ai)

For critical fields where you need full provenance, consider storing every value from every source:

```
field_value_history
├── id
├── entity_type, entity_id
├── field_name
├── field_value
├── source (csv_import/manual_entry/api/enrichment/merge)
├── source_id (import_job_id, user_id, etc.)
├── confidence (0.0-1.0)
├── is_canonical (boolean — currently active value)
├── created_at
└── superseded_at (when this value was replaced)
```

This gives you:
- Full audit trail of every value a field has ever had
- Source attribution for every piece of data
- The ability to "undo" a merge by reverting to previous canonical values
- Debugging capability: "why does this contact have this email?"

### Normalization Rules (Declarative, Not Hard-Coded)

Instead of scattering normalization logic across code, define rules declaratively:

```
normalization_rules
├── id
├── field_name (email/phone/company_name/person_name/date/address)
├── rule_type (transform/validate/flag)
├── rule_config (JSONB)
│   Examples:
│   {type: "lowercase"}
│   {type: "strip_dots", domain: "gmail.com"}
│   {type: "e164_normalize", default_country: "US"}
│   {type: "remove_legal_suffixes", suffixes: ["Inc", "LLC", "Ltd", ...]}
│   {type: "reject_disposable_domains", list: "disposable_domains.txt"}
│   {type: "reject_junk_values", patterns: ["^n/?a$", "^test", "^asdf"]}
├── priority (execution order)
└── is_active
```

---

## Part 5: Critical Design Decisions

### Decision 1: Every Entry Point Gets The Same Pipeline

This is non-negotiable. HubSpot's biggest flaw is that API-created records bypass dedup. Our architecture must enforce:

- CSV imports → full pipeline
- Manual form entry → full pipeline (inline, real-time)
- API calls (POST/PATCH) → full pipeline
- Integration syncs → full pipeline

For real-time entry points (manual, API), the pipeline runs synchronously but with fast-path optimizations (skip staging table, run blocking + comparison inline, return result immediately or queue for review).

### Decision 2: Probabilistic Scoring, Not Binary Match/No-Match

Every CRM we studied uses binary dedup: "this is a duplicate" or "this isn't." This is fundamentally wrong. The Fellegi-Sunter model gives calibrated probabilities that enable nuanced decisions.

**Implementation:** Assign m/u probabilities to each field comparison level. These can start with sensible defaults and be tuned over time based on reviewer feedback:

```
Field: email (canonicalized)
  Exact match:    m=0.95, u=0.0001  → weight ≈ +13.2
  Domain match:   m=0.70, u=0.01    → weight ≈ +6.1
  No match:       m=0.05, u=0.999   → weight ≈ -4.3

Field: last_name
  Exact match:    m=0.90, u=0.005   → weight ≈ +7.5
  JW ≥ 0.9:      m=0.85, u=0.008   → weight ≈ +6.7
  JW ≥ 0.8:      m=0.60, u=0.02    → weight ≈ +4.9
  Phonetic match: m=0.50, u=0.05    → weight ≈ +3.3
  No match:       m=0.10, u=0.95    → weight ≈ -3.2

Field: phone (E.164 normalized)
  Exact match:    m=0.85, u=0.00005 → weight ≈ +14.0
  No match:       m=0.15, u=0.9999  → weight ≈ -2.7
```

### Decision 3: AI-Assisted, Not AI-Dependent

Our current gatekeeper uses LLM calls for normalization, entity resolution, and validation. This is expensive and slow for batch operations. The architecture should be:

**Layer 1 — Deterministic rules (fast, free, reliable):**
- Email canonicalization
- Phone E.164 normalization
- Company suffix removal
- Date format detection
- Junk value detection
- Exact duplicate detection

**Layer 2 — Probabilistic matching (fast, free, reliable):**
- Fellegi-Sunter scoring with pre-computed m/u weights
- Jaro-Winkler / SoftTFIDF string similarity
- Blocking strategies for candidate generation

**Layer 3 — AI enhancement (slow, costly, but powerful):**
- Semantic company name resolution ("IBM" = "International Business Machines")
- Ambiguous name matching ("Bob" = "Robert")
- Complex field mapping for imports with unusual column structures
- Natural language field extraction from unstructured data

The AI layer is an enhancement on top of a solid deterministic/probabilistic foundation — not a replacement for it.

### Decision 4: The Staging Table Is Sacred

Raw import data must be preserved forever (or at least for a configurable retention period). This is your debugging lifeline. When something goes wrong 6 months later and someone asks "where did this bad data come from?", you need to trace it back to the exact row in the exact import file.

**What to store:**
- The raw, unmodified data exactly as received
- File metadata (encoding, delimiter, original filename)
- Every normalization decision made
- Every entity resolution score computed
- Every validation check result
- The user's approval/rejection decisions
- The survivorship rule applied to each field during merge

### Decision 5: Survivorship Rules Are Per-Field, Not Per-Record

"Right side wins" (Attio) is lazy. "Most recent wins" for everything is dangerous. The correct approach is field-level survivorship:

| Field | Default Strategy | Rationale |
|-------|-----------------|-----------|
| email | Source priority (CRM > import) | CRM email is verified by usage |
| phone | Most recent | Phone numbers change |
| first_name | Most complete (longest) | "Robert" beats "Bob" for canonical |
| last_name | Source priority (CRM > import) | Existing record more likely correct |
| job_title | Most recent | Titles change with promotions |
| company | Source priority with review | Company association is critical |
| address | Most recent | Addresses change |
| custom fields | Most complete | Prefer non-null values |

These should be configurable by admins in Settings.

### Decision 6: Intra-Import Dedup Is As Important As Cross-Database Dedup

A CSV file itself can contain duplicates. Before checking against existing data, deduplicate within the import batch. This prevents the scenario where rows 5 and 500 of a 1,000-row import are the same person, and both get created as new records because the first one hadn't been committed yet when the second was processed.

**Process:**
1. Sort import rows by blocking key
2. Compare within blocks inside the import
3. Merge intra-file duplicates (apply survivorship rules)
4. Then proceed to cross-database entity resolution

---

## Part 6: What This Means vs. What We Have Now

### What's Strong in Our Current Architecture
- Gatekeeper concept (AI-powered validation pipeline) ✓
- Review queue for uncertain cases ✓
- Change history tracking ✓
- Confidence scoring zones (green/yellow/red) ✓

### What Needs to Change
1. **Add true staging table** — raw import data must be preserved, not processed directly into production
2. **Add deterministic matching layer** — Fellegi-Sunter scoring with Jaro-Winkler, not just AI
3. **Add blocking strategies** — multi-pass blocking for efficient candidate generation
4. **Add per-field survivorship rules** — configurable, not "right side wins"
5. **Add intra-import dedup** — deduplicate within the batch before checking against DB
6. **Add import preview/confirmation step** — users see exactly what will happen before it happens
7. **Add batch processing with savepoints** — partial rollback capability for large imports
8. **Add post-commit integrity checks** — verify no orphans, no broken relationships
9. **Enforce pipeline for ALL entry points** — API, manual, integration, not just imports
10. **Add field value history** — EAV-style provenance tracking for critical fields

---

## Part 7: Logic Exercises — Stress Testing The Architecture

### Scenario 1: The Overlapping Trade Show Import

**Setup:** Two sales reps attend the same trade show. Each scans business cards and creates a CSV. They import on the same day. 40% overlap.

**Without this architecture:** 40% of contacts created as duplicates. Company records duplicated. Notes and interactions split across duplicate records. Sales manager gets conflicting pipeline reports.

**With this architecture:**
1. Rep A imports first → all 200 contacts go through staging → normalization → entity resolution (no existing matches for most) → preview shows "200 new records" → committed
2. Rep B imports 30 minutes later → 200 contacts go through staging → normalization → entity resolution finds ~80 matches with Rep A's newly committed records → preview shows "120 new records, 80 potential merges (avg 94% confidence)" → Rep B reviews the merges → approved → survivorship rules merge field values intelligently → result: 320 unique contacts, zero duplicates

### Scenario 2: The Catastrophic Excel Corruption

**Setup:** Marketing exports 5,000 contacts from an event platform as CSV. Opens in Excel to "clean it up." Saves. Imports.

**Without this architecture:** Phone numbers lose leading zeros and + signs. Dates get reformatted ambiguously. Long IDs get scientific notation. Data is silently destroyed.

**With this architecture:**
1. Stage 1 stores the raw data (but Excel already corrupted it — we can't fix what happened before our system)
2. Stage 2 normalization detects: 847 phone numbers that don't parse as valid E.164, 156 dates that are ambiguous, 23 fields with scientific notation patterns
3. Stage 4 validation flags all of these as FAILED_FIXABLE or FAILED_BLOCKED
4. Preview shows: "4,000 valid rows, 1,000 rows with issues. Download error report."
5. User sees the errors, realizes Excel corrupted the data, goes back to the source platform and exports again without opening in Excel
6. **Prevention > cure.** The architecture caught the corruption before it entered production.

### Scenario 3: The "Same Person, Three Systems" Problem

**Setup:** "John Smith" exists as:
- CRM contact: john.smith@acme.com, (415) 555-1234, VP Sales
- Marketing tool sync: j.smith@acme.com, no phone, Director of Sales
- Partner list import: John Smith, +1-415-555-1234, john.smith@acme.com, VP of Sales, Acme Inc.

**Without this architecture:** Three records. Marketing sends the same email three times. Sales rep doesn't see the full picture.

**With this architecture:**
1. Partner list import enters staging
2. Normalization: phone → +14155551234, email → johnsmith@acme.com (gmail-style dot removal doesn't apply to acme.com, so stays as-is)
3. Blocking: email domain "acme.com" generates candidate set. Phone last-7 "5551234" generates another.
4. Entity resolution compares against both existing records:
   - vs CRM contact: email exact match (w=+13.2), phone exact after normalization (w=+14.0), name exact (w=+7.5) → total probability: 99.99%
   - vs Marketing contact: email domain match (w=+6.1), name partial (w=+4.9) → total probability: 87%
5. System identifies all three as the same person with high confidence
6. Survivorship rules: email from CRM (source priority), phone from import (most recent/complete), title from import (most recent: "VP of Sales"), company from CRM (source priority)
7. Result: one golden record with the best data from all sources

### Scenario 4: The 50,000-Row Partner Data Dump

**Setup:** A partner sends a massive CSV with 50,000 leads. Different column structure, European phone formats, company names in German.

**With this architecture:**
1. Raw ingestion: store all 50K rows with original encoding detected (ISO-8859-1)
2. Column mapping: AI-assisted field mapping suggests mappings, user confirms
3. Normalization: E.164 for European phones (detect +49 prefix for Germany), company name normalization (handle GmbH, AG suffixes)
4. Intra-import dedup: find ~2,000 duplicates within the file itself
5. Entity resolution: multi-pass blocking against existing DB → find ~5,000 matches
6. Preview: "43,000 new records, 5,000 updates/merges, 2,000 intra-file duplicates resolved, 500 validation failures"
7. User reviews merge decisions for the uncertain ones (70-89% confidence)
8. Atomic commit: process in batches of 500 with savepoints
9. Batch 37 fails (referential integrity issue) → rolled back → other 99 batches committed → user fixes batch 37 → retries → done
10. Total time: minutes, not hours. Zero duplicates. Full audit trail.

---

## Part 8: Defense Matrix — Every Failure Mode Mapped to Its Prevention

This is the concrete system. Every one of the 33 failure modes has a specific mechanism that stops it. No abstractions — just "this breaks → this catches it."

### A. Duplicate Records

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 1 | **Exact duplicates** from re-imports / form resubmissions | **Email/phone exact match after canonicalization** | Stage 3 (Entity Resolution) | Canonicalize email (lowercase, strip gmail dots, normalize plus-addressing). Canonicalize phone to E.164. Exact match on either = 99%+ confidence → auto-merge. Zero false negatives on exact duplicates. |
| 2 | **Fuzzy duplicates** from spelling variations, abbreviations, typos | **Fellegi-Sunter probabilistic scoring + Jaro-Winkler** | Stage 3 (Entity Resolution) | Multi-pass blocking generates candidate pairs. Jaro-Winkler on names (≥0.9 threshold catches typos, ≥0.8 catches abbreviations). Field weights combined → probability score. 70-89% goes to human review, not silent creation. |
| 3 | **Cross-object duplicates** (same person as Lead AND Contact) | **Unified entity model — no Lead/Contact split** | Architecture Decision | We don't have a Lead vs Contact distinction. Single `contacts` table with lifecycle stages. Eliminates the problem structurally. If we add Leads later: same entity resolution pipeline runs across both tables. |
| 4 | **Multi-source duplicates** (marketing + trade show + web form) | **Every entry point runs the same pipeline** | Decision 1 + Stage 3 | CSV, API, manual entry, integration sync — all hit the same entity resolution engine. No bypass path. Multi-pass blocking (email domain + name phonetic + phone suffix + company domain) ensures candidates are found regardless of which fields the source provides. |

### B. Formatting Inconsistencies

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 5 | **Phone format chaos** (`(415) 555-1234` vs `+14155551234`) | **E.164 normalization via libphonenumber logic** | Stage 2 (Normalization) | Every phone number, from every source, is normalized to E.164 (`+14155551234`) before storage. Normalization handles parentheses, dots, dashes, spaces, country codes. Non-parseable numbers flagged as `FAILED_FIXABLE`. |
| 6 | **Address inconsistency** ("Street" vs "St" vs "St.") | **Token-level normalization + abbreviation dictionary** | Stage 2 (Normalization) | Declarative normalization rules expand/standardize abbreviations (St→Street, Ste→Suite, Ave→Avenue). Applied via `normalization_rules` table. Token-level Jaccard + Levenshtein used in entity resolution for fuzzy address matching. |
| 7 | **Name parsing errors** ("Dr. Stephen Vincent Strange" → First: "Dr.") | **Prefix/suffix-aware name parser** | Stage 2 (Normalization) | Dedicated name parsing that recognizes prefixes (Dr, Mr, Mrs, Prof), suffixes (Jr, Sr, III, PhD), compound names (van der, de la, O'), and multi-word first names. Stores parsed components separately: `prefix`, `first_name`, `middle_name`, `last_name`, `suffix`. |
| 8 | **Date ambiguity** (`05/04/2024` — May 4 or April 5?) | **Source-locale detection + ISO 8601 normalization** | Stage 2 (Normalization) | Detect source locale from file metadata or column header hints. When ambiguous (all days ≤12), flag for user confirmation during preview. Store all dates as ISO 8601 (`2024-05-04`). Validation rejects impossible dates (month >12, day >31). |
| 9 | **Company name variations** ("Acme" vs "Acme Inc" vs "ACME LLC") | **7-step normalization pipeline + alias table + SoftTFIDF** | Stage 2 + Stage 3 | Normalization: strip legal suffixes, standardize case, handle punctuation, expand abbreviations, strip "The", remove geographic qualifiers. Entity resolution: SoftTFIDF similarity handles token reordering. Alias table maps known synonyms ("IBM" → "International Business Machines"). Domain matching as supplementary signal. |
| 10 | **Picklist mismatches** ("USA" vs "United States" vs "US") | **Canonical value mapping in normalization rules** | Stage 2 (Normalization) | Declarative mapping rules in `normalization_rules` table: `{type: "canonical_map", mappings: {"USA": "United States", "US": "United States", "U.S.": "United States", ...}}`. Applied to country, state, industry, and any picklist field. Unmapped values flagged for review. |

### C. Missing & Incomplete Data

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 11 | **Required fields left empty** (contacts without email) | **Completeness validation with configurable required fields** | Stage 4 (Validation Gate) | Validation rules define required fields per entity type. Missing required fields → `FAILED_BLOCKED` status. User sees exactly which rows failed and why in preview. Can fix and re-submit, or approve with explicit acknowledgment of missing data. |
| 12 | **Skeleton records** from integrations syncing partial data | **Minimum viable record threshold** | Stage 4 (Validation Gate) | Business rule: a contact must have at minimum (email OR phone) AND (first_name OR last_name). Records below threshold → `FAILED_BLOCKED` with clear message: "Record has insufficient data to create." Integration syncs held to the same standard — no partial-data exceptions. |
| 13 | **Placeholder/junk values** ("N/A", "test", "asdf", ".", " ") | **Junk value detection via regex pattern matching** | Stage 2 (Normalization) | Declarative rules: `{type: "reject_junk_values", patterns: ["^n/?a$", "^test$", "^asdf", "^xxx", "^\\.$", "^\\s+$", "^-+$", "^0+$", "^none$", "^null$", "^undefined$"]}`. Matched values are nullified (not rejected — the row continues, the field is just treated as empty). Logged in normalization report. |

### D. Stale & Outdated Data

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 14 | **Natural decay** (30% job changes/year) | **Data age tracking + decay detection** | Phase 5 (Continuous Quality) | `field_value_history` tracks when each field was last updated. Scheduled job flags records where key fields (email, phone, title, company) haven't been updated in >6 months. Dashboard shows decay rate. Enrichment waterfall can be triggered to refresh stale records. |
| 15 | **Logical decay** (zero-engagement leads marked "hot") | **Activity-based freshness scoring** | Phase 5 (Continuous Quality) | Scheduled job cross-references contact status against activity timeline. Contact marked "hot" with no activity in 90 days → auto-downgrade or flag for review. Rules configurable per lifecycle stage. |
| 16 | **Regulatory decay** (GDPR deletion requests unprocessed) | **Deletion request queue + cascade enforcement** | Post-Commit (Stage 7) | Dedicated deletion workflow that cascades across all tables: contact record, activities, deals associations, field_value_history, import_staging references. Audit log records the deletion with reason. Scheduled compliance check flags overdue requests. |

### E. Orphaned & Broken Relationships

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 17 | **Contacts without company** | **Post-commit orphan detection** | Stage 7 (Post-Commit Verification) | After every import commit, query for contacts with no company association. Flag as "orphaned" in validation report. During import: if company name is provided as text, attempt entity resolution against companies table → link if match found, create new company if not, flag for review if ambiguous. |
| 18 | **Deals without contacts** | **Referential integrity validation** | Stage 4 (Validation Gate) | Validation rule: deal must have at least one associated contact. Import rows creating deals without contact reference → `FAILED_BLOCKED`. For existing data: scheduled integrity scan detects and flags. |
| 19 | **Activities pointing to deleted/merged records** | **Merge cascade + foreign key re-pointing** | Stage 6 (Atomic Commit) | When records merge, all activities, notes, tasks, and deals from the losing record are re-pointed to the winning record within the same transaction. Deletion cascades update or nullify foreign keys. `field_value_history` preserves the original associations for audit. |
| 20 | **Broken parent-child company hierarchies** | **Hierarchy validation + circular reference detection** | Stage 4 (Validation Gate) | Validation checks: parent company must exist, no circular references (A parent of B parent of A), max depth limit. Import rows that would create invalid hierarchies → `FAILED_BLOCKED`. Post-commit verification confirms hierarchy integrity. |

### F. Import-Specific Corruption

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 21 | **Excel auto-formatting destruction** (leading zeros stripped, dates mangled, scientific notation, 15-digit precision, first-200-row type inference) | **Pattern detection + user warning** | Stage 2 + Stage 4 | Detect scientific notation patterns (`\d+\.?\d*[eE]\+?\d+`), suspiciously round numbers that suggest precision loss, phone numbers missing leading zeros. Flag affected rows as `FAILED_FIXABLE` with specific message: "This value appears to have been corrupted by Excel. Re-export from source as CSV without opening in Excel." Preview shows total affected rows prominently. |
| 22 | **Character encoding corruption** (UTF-8 vs Latin-1 = mojibake) | **Encoding detection + UTF-8 normalization** | Stage 1 (Raw Ingestion) | Auto-detect encoding using byte sequence analysis (BOM detection, UTF-8 validation, chardet-style heuristic). Convert to UTF-8 on ingestion. If detection confidence is low, show encoding options in preview with sample text so user can confirm. Store original encoding in `file_metadata`. |
| 23 | **Column mapping errors** (phone in email field) | **Type validation per field + AI-assisted column mapping** | Stage 2 + Stage 4 | After column mapping (AI-suggested, user-confirmed), validate that mapped values match expected type: email fields must contain `@`, phone fields must parse as phone numbers, dates must parse as dates. Systematic mismatches (>30% of column failing type check) trigger a warning: "Column 'Phone' may be incorrectly mapped — 73% of values don't look like phone numbers." |
| 24 | **Delimiter confusion** (commas in company names break CSV) | **Smart delimiter detection** | Stage 1 (Raw Ingestion) | Try multiple delimiters (comma, semicolon, tab, pipe) and score each by consistency of column count across rows. If comma-delimited but many rows have inconsistent column counts, try semicolon or tab. If RFC 4180 quoting is detected (quoted fields with embedded commas), parse accordingly. Preview shows parsed columns so user confirms before proceeding. |
| 25 | **Row truncation** (Excel's 1M row limit silently drops data) | **Row count validation against source metadata** | Stage 1 (Raw Ingestion) | If file has exactly 1,048,576 rows (Excel limit) or 65,536 rows (old Excel limit), warn: "This file appears to hit Excel's row limit. Data may have been truncated." If source metadata includes expected row count, validate against actual. |
| 26 | **Relational data flattened** (company name as text, not FK) | **Entity resolution for embedded references** | Stage 3 (Entity Resolution) | When a contact import includes a company name column, run entity resolution against the companies table: exact match → link FK, fuzzy match → preview for user confirmation, no match → offer to create new company or leave unlinked. Never store company as free text in the contact record. |
| 27 | **BOM bytes breaking parsers** | **BOM detection and stripping** | Stage 1 (Raw Ingestion) | Check first 3 bytes for UTF-8 BOM (`EF BB BF`), UTF-16 BOM (`FF FE` or `FE FF`). Strip before parsing. Log in normalization report. |
| 28 | **Hidden whitespace** (non-breaking spaces, zero-width chars, trailing spaces) | **Invisible character stripping** | Stage 2 (Normalization) | Strip: U+00A0 (non-breaking space) → regular space, U+200B (zero-width space) → remove, U+200C/U+200D (zero-width non-joiner/joiner) → remove, U+FEFF (BOM mid-string) → remove, U+00AD (soft hyphen) → remove. Collapse multiple spaces. Trim leading/trailing. Applied to ALL text fields before any comparison or storage. |

### G. Systemic Degradation

| # | Failure Mode | Prevention Mechanism | Pipeline Stage | How It Works |
|---|-------------|---------------------|----------------|--------------|
| 28* | **Multi-user import storms** (different teams, no coordination) | **Import job serialization + cross-import dedup** | Stage 3 + Stage 6 | Entity resolution always runs against the latest committed state, including records committed by imports running concurrently. Import jobs in Stage 6 (Atomic Commit) acquire a lightweight advisory lock to prevent race conditions where two imports try to create the same record simultaneously. Import dashboard shows all in-progress imports so teams have visibility. |
| 30 | **API-created records bypassing dedup** | **Universal pipeline enforcement — no bypass** | Decision 1 | Every POST/PATCH to any entity endpoint runs through the same pipeline: normalize → entity resolution → validation. For real-time endpoints (API, manual entry), this runs inline with fast-path optimizations (skip staging table for single records, run blocking directly). The pipeline is not optional — it's the only path to create/update records. |
| 31 | **No system-of-record defined** | **Per-field survivorship rules with explicit source priority** | Stage 6 + Decision 5 | `survivorship_rules` table defines, per entity type and field, which source wins when values conflict. Admins configure in Settings: "For email, CRM manual entry > enrichment > CSV import." Every merge applies these rules deterministically. No ambiguity about which value wins or why — it's logged in `entity_resolution_log`. |
| 32 | **Concurrent update conflicts** (two reps update same record, last-write-wins) | **Optimistic locking with version column** | Stage 6 (Atomic Commit) | Each record has an `updated_at` timestamp (or version counter). Updates include the expected version. If the version has changed since the user loaded the record, the update fails with a conflict error showing both values, letting the user choose. For imports: batch processing with advisory locks prevents concurrent modification of the same record by two imports. |
| 33 | **Integration sync drift** (field mappings change in one system) | **Schema contract validation + sync health monitoring** | Stage 4 + Phase 5 | Integration field mappings are stored as versioned configuration. On each sync, validate that incoming data still conforms to the expected schema (field names exist, types match, required fields present). If >10% of synced records fail validation, pause the sync and alert. Sync health dashboard shows mapping health, failure rates, and drift over time. |

### Defense Coverage Summary

```
Failure Modes Covered by Each Pipeline Stage:

Stage 1 (Raw Ingestion):     #22, #24, #25, #27          — 4 failure modes
Stage 2 (Normalization):     #5, #6, #7, #8, #9, #10,
                             #13, #21, #28                — 9 failure modes
Stage 3 (Entity Resolution): #1, #2, #4, #26, #28*       — 5 failure modes
Stage 4 (Validation Gate):   #11, #12, #18, #20, #21,
                             #23, #33                     — 7 failure modes
Stage 5 (Preview):           #8, #21, #23, #24           — 4 failure modes (user confirmation)
Stage 6 (Atomic Commit):     #19, #28*, #31, #32          — 4 failure modes
Stage 7 (Post-Commit):       #16, #17                     — 2 failure modes
Architecture Decisions:      #3, #4, #30                  — 3 failure modes
Phase 5 (Continuous):        #14, #15, #33                — 3 failure modes

Note: Several failure modes have defense-in-depth across multiple stages.
      #21 (Excel corruption) is caught at Stages 2, 4, AND 5.
      #28* (import storms) is caught at Stages 3 AND 6.
```

### What This Means In Practice

**Zero failure modes are undefended.** Every single one of the 33 documented ways CRM data gets corrupted has at least one — usually two or three — specific mechanisms that prevent it. This isn't "we hope the AI catches it." This is deterministic, rules-based prevention with probabilistic scoring as a second layer and AI as a third.

The key insight: **most corruption is preventable with simple, deterministic rules** (normalization, type checking, required field validation). The hard problems (fuzzy matching, company name resolution, survivorship) need probabilistic and AI layers. But the foundation is boring, reliable, rule-based prevention that never fails because it doesn't depend on model accuracy or API availability.

---

## Part 9: Implementation Priority

### Phase 1: Foundation (The Non-Negotiables)
1. Import staging table + raw data preservation
2. Deterministic normalization pipeline (phone, email, company name, dates)
3. Intra-import deduplication
4. Import preview with user confirmation before commit
5. Batch processing with savepoints

### Phase 2: Entity Resolution Engine
6. Multi-pass blocking strategy
7. Fellegi-Sunter scoring with configurable m/u weights
8. String similarity functions (Jaro-Winkler, SoftTFIDF)
9. Three-zone decision system (auto-merge / review / new record)
10. Review queue with side-by-side comparison

### Phase 3: Survivorship & Provenance
11. Per-field survivorship rules (configurable in Settings)
12. Field value history (EAV provenance tracking)
13. Merge undo capability
14. Import rollback capability

### Phase 4: Universal Pipeline
15. Apply pipeline to API POST/PATCH calls (inline, real-time)
16. Apply pipeline to manual form entry (inline)
17. Apply pipeline to integration syncs
18. Post-commit integrity verification

### Phase 5: Continuous Quality
19. Scheduled existing-data dedup scans (batch Fellegi-Sunter against full DB)
20. Data decay detection (flag records not updated in X months)
21. Data quality dashboard (completeness scores, duplicate rates, validation failure trends)
22. Feedback loop: reviewer decisions tune m/u weights over time
23. Golden set validation: maintain a curated set of known-correct matches and non-matches, periodically run the model against it to detect drift
24. Continuous sampling: spot-check 1-5% of auto-merged records to catch systematic errors

---

## Sources

### CRM Architecture Research
- [Attio Data Model](https://attio.com/platform/data)
- [Attio Duplicate Detection](https://attio.com/apps/check-for-duplicates)
- [Attio Merge Records](https://attio.com/help/reference/managing-your-data/records/merge-and-delete-records)
- [Day.ai AI-Native CRM Architecture](https://www.day.ai/resources/building-the-ai-native-crm-at-day-ai)
- [HubSpot Duplicate Management](https://community.hubspot.com/t5/CRM/Do-you-have-HubSpot-AND-Salesforce-Duplicates/m-p/708539)
- [5 Common HubSpot Data Quality Issues](https://blog.insycle.com/common-hubspot-data-quality-issues)
- [Clay Waterfall Enrichment](https://www.clay.com/waterfall-enrichment)

### Entity Resolution & Data Science
- [Splink: Fellegi-Sunter Implementation](https://moj-analytical-services.github.io/splink/topic_guides/theory/fellegi_sunter.html)
- [The Mathematics of Fellegi-Sunter](https://www.robinlinacre.com/maths_of_fellegi_sunter/)
- [Interactive Introduction to Record Linkage](https://www.robinlinacre.com/intro_to_probabilistic_linkage/)
- [Golden Record Definition & Use Cases](https://www.saber.app/glossary/golden-record)
- [MDM Survivorship Strategies](https://profisee.com/blog/mdm-survivorship/)
- [What Is Entity Resolution](https://www.rudderstack.com/blog/what-is-entity-resolution/)

### Data Quality & Failure Modes
- [CRM Data Validation: Stop Bad Data](https://databar.ai/blog/article/crm-data-validation-stop-bad-data-before-it-enters-your-crm)
- [Cost of Bad CRM Data](https://www.fullcast.com/content/the-cost-of-bad-crm-data-and-how-to-fix-it/)
- [Gene Name Errors from Excel](https://link.springer.com/article/10.1186/s13059-016-1044-7)
- [Fixing CRM Database Chaos in 2026](https://www.fullfunnel.co/blog/fixing-crm-chaos-in-2026)
- [Data Pipeline: Managing Invalid Records](https://www.theodo.com/en-fr/blog/data-pipeline-strategies-to-manage-invalid-records)

### Architecture Patterns
- [Event Sourcing Pattern (Microsoft Azure)](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Staging Database for Data Migration (Microsoft)](https://learn.microsoft.com/en-us/power-platform/architecture/key-concepts/data-migration/staging-database-approach)
- [Data Quality Pipeline Architecture (DQOps)](https://dqops.com/architectures-for-integrating-data-quality-checks-into-data-pipelines/)
- [Splink GitHub](https://github.com/moj-analytical-services/splink)
