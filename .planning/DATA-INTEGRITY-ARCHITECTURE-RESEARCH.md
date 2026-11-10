# Data Integrity Architecture Research Report

## Comprehensive Patterns for CRM Data Integrity

*Research conducted March 2026*

---

## Table of Contents

1. [Event Sourcing & CQRS for CRM Data](#1-event-sourcing--cqrs-for-crm-data)
2. [Immutable Data Patterns](#2-immutable-data-patterns)
3. [Schema-on-Read vs Schema-on-Write for Imports](#3-schema-on-read-vs-schema-on-write-for-imports)
4. [Data Validation Pipelines](#4-data-validation-pipelines)
5. [Confidence Scoring](#5-confidence-scoring)
6. [Human-in-the-Loop Review Queues](#6-human-in-the-loop-review-queues)
7. [Transactional Imports with Rollback](#7-transactional-imports-with-rollback)
8. [CDC (Change Data Capture) Patterns](#8-cdc-change-data-capture-patterns)
9. [Canonical Data Models](#9-canonical-data-models)
10. [Open-Source Entity Resolution Tools](#10-open-source-entity-resolution-tools)
11. [Recommendations for Whop CRM](#11-recommendations-for-whop-crm)

---

## 1. Event Sourcing & CQRS for CRM Data

### What It Is

Event sourcing stores every state change as an immutable, append-only event rather than overwriting current state. CQRS (Command Query Responsibility Segregation) separates the write model (event store) from the read model (materialized projections optimized for queries).

### How It Helps Data Integrity

- **Complete audit trail**: Every single state change is captured as a meaningful, immutable event, providing a 100% accurate and verifiable history. No external audit logging needed.
- **Time-travel debugging**: Systems can be reconstructed to any historical point. Developers can reproduce bugs by replaying the exact sequence of events that led to a failure.
- **Rollback via compensation**: Since events are immutable, "rollback" is achieved by appending compensating events (e.g., `ContactEmailCorrected` undoes a bad `ContactEmailUpdated`). The history of both the mistake and the correction is preserved.
- **Resilient projections**: Read models are derived and ephemeral. If a projection is corrupted, it can be safely deleted and rebuilt from the event log.

### Implementation Components

| Component | Purpose |
|-----------|---------|
| **Event Store** | Append-only, immutable, strictly ordered database (e.g., EventStoreDB, or a Postgres table with append-only constraints) |
| **Aggregate Rehydration** | Load empty entity, replay its event stream, reconstruct current state |
| **Snapshots** | Periodic serialized state to avoid replaying thousands of events (e.g., every 100 events) |
| **Projections** | Denormalized read models derived from events, optimized for specific query patterns |

### Critical Challenges

- **Complexity**: Steep learning curve affecting modeling, persistence, querying, and event evolution. Requires expertise in event design, versioning, projections, and eventual consistency.
- **Eventual consistency**: Read models lag behind writes. UI must handle "Your change is being processed" states.
- **Event versioning**: Business requirements evolve but old events are immutable. Requires upcasting (transforming old event formats on-the-fly during replay).
- **GDPR conflict**: Immutability conflicts with "right to be forgotten." Mitigation: cryptographic erasure (encrypt PII per-entity, delete encryption keys on erasure request).
- **Storage growth**: Event log grows indefinitely. Requires tiered storage or archival strategies.

### Decision Framework

Event sourcing is worth the complexity when:
1. Change history is a first-class business requirement
2. Audit/compliance demands an immutable action log
3. Domain logic is complex with long-running processes or state machines
4. The application can tolerate eventual consistency in reads
5. The team has expertise to manage the architectural complexity

For a CRM like Whop's, **full event sourcing is likely overkill**. A **hybrid approach** -- CRUD with event logging (change history table) -- provides 90% of the audit benefit at 20% of the complexity.

---

## 2. Immutable Data Patterns

### The Datomic Model

Datomic pioneered the immutable database concept with a fundamentally different approach to data:

- **Facts as datoms**: Every piece of data is stored as `[entity, attribute, value, transaction, added?]` -- an atomic fact with a time coordinate.
- **Never overwrite**: Updates don't replace old values. A new fact is asserted, and the old fact is retracted. Both remain in the database forever.
- **Time-travel queries**: Any query can include `as-of` a specific transaction or point in time, reconstructing the exact state of the database at that moment.
- **Bi-temporal modeling**: Stores both valid time (when was this true in the real world?) and transaction time (when did we record this?), enabling complex temporal queries.

### Practical Patterns for CRM

You don't need Datomic to get immutable data benefits. The key patterns are:

**Pattern 1: Append-Only Change Log**
```
change_history table:
  id, entity_type, entity_id, field_name,
  old_value, new_value, changed_by, changed_at, change_reason
```
Every UPDATE to a contact/company/deal also inserts a row here. Simple, queryable, and provides full field-level history.

**Pattern 2: Versioned Records**
```
contacts table:
  id, version, first_name, last_name, email, ...
  valid_from, valid_to, is_current
```
Each update creates a new version. Current state is `WHERE is_current = true`. History is all rows for that entity.

**Pattern 3: Soft Deletes with Tombstones**
Never physically delete records. Mark them with `deleted_at` and filter in queries. Allows recovery and maintains referential integrity.

### Trade-offs

| Pattern | Complexity | Query Performance | Storage | Audit Completeness |
|---------|-----------|-------------------|---------|-------------------|
| Change log | Low | Good (current state is direct) | Moderate | Field-level |
| Versioned records | Medium | Requires filtering | High | Full snapshot per change |
| Full event sourcing | High | Requires projection | Highest | Complete |

### Recommendation

For a CRM, **Pattern 1 (append-only change log)** is the sweet spot. It's what you already have with `change_history` / `gatekeeper_decision_log`. The key improvement is ensuring EVERY mutation path writes to it consistently, including bulk operations and imports.

---

## 3. Schema-on-Read vs Schema-on-Write for Imports

### Core Difference

| Aspect | Schema-on-Write | Schema-on-Read |
|--------|----------------|----------------|
| When validation happens | Before data is stored | When data is queried/used |
| Ingestion speed | Slower (must validate) | Fast (store raw) |
| Query performance | Fast (data is clean) | Slower (must interpret) |
| Flexibility | Low (rigid schema) | High (any format) |
| Data quality | High (enforced) | Variable (depends on read logic) |

### How This Applies to CRM Imports

**Schema-on-Write (current approach)**: Validate every row against the CRM schema during import. Reject or flag rows that don't conform. Data in the system is always clean.

**Schema-on-Read (data lake approach)**: Store the raw CSV as-is in a staging area. Apply transformations and validation when the data is queried or when a user explicitly maps and commits it.

**Hybrid (recommended for CRM imports)**:

```
Raw CSV --> [Stage 1: Schema-on-Read] --> Staging Table (raw, unvalidated)
                                              |
                                     [Stage 2: Schema-on-Write] --> Production Tables
                                              |
                                     [Stage 3: Quarantine] --> Review Queue
```

1. **Ingest raw**: Accept the CSV without validation into a staging/import_jobs table. Fast, never loses data.
2. **Transform and validate**: Apply field mapping, normalization, and validation rules. This is where schema-on-write kicks in.
3. **Route by confidence**: Clean rows go to production. Ambiguous rows go to review queue. Bad rows go to error report.

### Key Insight

The hybrid approach means you **never lose the original data**. If your validation rules change, you can re-process from staging. If a user maps a field wrong, the raw data is still there for re-mapping. This is exactly the pattern used by best-in-class data platforms.

---

## 4. Data Validation Pipelines

### Tool Landscape (2026)

Three major open-source approaches dominate data quality:

**dbt (Data Build Tool)**
- Validation integrated into transformation workflows
- Four test types: `unique`, `not_null`, `accepted_values`, `relationships`
- Tests defined in YAML alongside model definitions
- Extensible via packages like `dbt-expectations`
- Best for: in-pipeline validation during transformation

**Great Expectations (GX)**
- Standalone validation framework with "Expectations" (declarative assertions)
- Auto-profiling generates expectations from existing data
- Auto-generated documentation ("Data Docs") for stakeholder visibility
- Strong Python integration, works with Airflow, Spark, Pandas
- Best for: comprehensive, documented validation suites

**Soda Core**
- YAML-based Soda Checks Language (SodaCL) -- most human-readable
- Converts readable rules into SQL queries
- Built-in anomaly detection and alerting
- Data contracts for cross-team agreements
- Best for: simple, collaborative data quality monitoring

### Patterns Applicable to CRM Imports

**Expectation-Based Validation** (from Great Expectations):
```yaml
expectations:
  - expect_column_values_to_not_be_null:
      column: email
  - expect_column_values_to_match_regex:
      column: email
      regex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  - expect_column_values_to_be_in_set:
      column: country
      value_set: ["US", "CA", "GB", ...]
  - expect_column_pair_values_to_be_unique:
      column_A: first_name
      column_B: last_name
      column_C: email
```

**Validation Pipeline Architecture**:
```
Import File
    |
    v
[Parse & Type Detection] --> Schema validation errors
    |
    v
[Field-Level Rules] --> Null checks, format checks, range checks
    |
    v
[Cross-Field Rules] --> Referential integrity, business logic
    |
    v
[Statistical Rules] --> Anomaly detection (e.g., 90% of emails from same domain)
    |
    v
[Entity Resolution] --> Duplicate detection, merge candidates
    |
    v
[Route: Clean | Review | Reject]
```

**Key Principles**:
- Define validation rules as code (version-controlled, testable)
- Run validations in stages (fail fast on obvious errors)
- Generate human-readable reports for every import
- Track validation metrics over time (what % of imports pass cleanly?)

---

## 5. Confidence Scoring

### How Scoring Works

Confidence scoring assigns a numerical probability (0-100% or 0-1) that two records represent the same real-world entity. The score combines evidence from multiple fields with different weights.

### The Fellegi-Sunter Model (used by Splink)

The gold standard for probabilistic record matching uses three parameters:

- **lambda**: Prior probability that any two random records match
- **m probability**: Probability of observing a match on a field *given the records truly match* (measures data quality -- e.g., m=0.98 for date of birth means 98% of true matches share DOB)
- **u probability**: Probability of observing a match on a field *given the records do NOT match* (measures coincidence -- e.g., u=0.005 for surname means 0.5% of non-matches accidentally share a surname)

**Match weight per field** = log2(m/u)

Fields with rare values (low u) contribute more evidence. A matching Social Security Number (u near 0) is much stronger evidence than a matching first name (u might be 0.05).

**Total match weight** = Sum of all field weights + prior weight

**Conversion to probability**: `P(match) = 2^weight / (1 + 2^weight)`

| Match Weight | Probability |
|-------------|-------------|
| 0 | 50% |
| 4 | ~94% |
| 7 | ~99.2% |
| 10 | ~99.9% |
| -4 | ~6% |

### Practical Threshold Configuration

Based on research across multiple entity resolution systems:

| Zone | Confidence Range | Action | Rationale |
|------|-----------------|--------|-----------|
| **Auto-merge** | > 90-95% | Merge without review | High confidence, multiple strong signals |
| **Review queue** | 60-90% | Human decision needed | Ambiguous evidence, partial matches |
| **Auto-reject** | < 50-60% | Not a match | Insufficient evidence |
| **Exact match** | 100% | Immediate merge | Identical on unique identifiers (email, phone) |

### Multi-Field Confidence Strategy

Best practice is a layered approach:
1. **Deterministic pass first**: Exact match on email, phone, or external ID = instant merge (100%)
2. **Probabilistic pass second**: Fellegi-Sunter style scoring on name + company + location for remaining records
3. **Contextual boosting**: Same country AND same industry boosts confidence; different country AND same name reduces it

### Field Weight Recommendations for CRM

| Field | Relative Weight | Rationale |
|-------|----------------|-----------|
| Email | Very High | Near-unique identifier |
| Phone | High | Relatively unique, but formatting varies |
| Company + Name | High (combined) | Neither alone is sufficient |
| Full Name | Medium | Common names reduce signal |
| Domain | Medium | Many contacts per company |
| City + State | Low | Corroborating evidence only |
| First Name alone | Low | Too many collisions |

---

## 6. Human-in-the-Loop Review Queues

### When to Auto-Merge vs Queue for Review

**Auto-merge when**:
- Confidence > 90% AND matching on a strong identifier (email, phone)
- Multiple independent signals agree (name + company + domain all match)
- The merge is non-destructive (no conflicting field values)

**Queue for review when**:
- Confidence is 60-90% (ambiguous zone)
- Fields conflict (two different emails, two different companies)
- The match depends on fuzzy/phonetic similarity only
- High-value records where mistakes are costly
- First import from a new data source (trust hasn't been established)

**Auto-reject when**:
- Confidence < 50%
- Key discriminating fields clearly differ (different country AND different company AND different name)

### UX Patterns That Work

**1. Side-by-Side Comparison**
Show both records with field-level highlighting:
- Green: fields that match
- Yellow: fields that are similar (fuzzy match)
- Red: fields that conflict
Include the confidence score and which fields contributed most to the match.

**2. Batch Review by Similarity**
Group similar cases together so reviewers stay in one mental mode. A reviewer handling 20 "same name, different email" cases will develop pattern recognition faster than reviewing random cases.

**3. One-Click Actions**
- "Merge (keep left)" / "Merge (keep right)" / "Merge (keep best)"
- "Not a match -- dismiss"
- "Need more info -- skip for now"
Minimize cognitive load. The reviewer shouldn't need to fill out forms.

**4. Contextual Metadata**
Show the reviewer everything they need in one view:
- The specific rule that triggered the review
- The confidence score and what drove it
- Related records (other contacts at same company)
- Source of each record (import file vs manual entry)

**5. Feedback Loop**
- Track reviewer decisions as training data
- If reviewers consistently approve matches at 85%+ confidence, consider raising the auto-merge threshold
- If reviewers consistently reject matches at 70%, lower the review threshold
- Monitor for inter-reviewer disagreement as a quality signal

### Queue Management

- **SLA tracking**: Flag items that have been in queue > 24 hours
- **Priority scoring**: High-value records (enterprise contacts, active deals) get priority
- **Volume monitoring**: If queue grows faster than review capacity, tighten auto-merge OR auto-reject thresholds
- **Continuous sampling**: Even auto-merged records should be spot-checked (1-5% sample) to catch systematic errors

---

## 7. Transactional Imports with Rollback

### The Core Problem

A 10,000-row CSV import needs to be atomic enough that a failure at row 5,000 doesn't leave the database in an inconsistent state, but wrapping 10,000 inserts in a single database transaction creates lock contention and memory pressure.

### Pattern Comparison

| Pattern | Atomicity | Performance | Complexity | Recovery |
|---------|-----------|-------------|------------|----------|
| Single transaction | Full | Poor (locks, memory) | Low | Automatic rollback |
| Batch transactions | Per-batch | Good | Medium | Resume from failed batch |
| Saga with compensation | Logical | Good | High | Compensating transactions |
| Two-phase (stage + commit) | Full | Good | Medium | Delete staging data |

### Recommended: Two-Phase Import with Batch Processing

**Phase 1: Stage (reversible)**
```
1. Create import_job record (status: 'processing')
2. Parse CSV into import_rows table (raw data, no FK constraints)
3. Validate each row, mark as: valid | warning | error
4. Run entity resolution against existing data
5. Generate import preview (summary stats, sample matches)
6. Status: 'awaiting_confirmation'
```

**Phase 2: Commit (batched transactions)**
```
1. User confirms import (or auto-confirm if confidence is high)
2. Process in batches of 100-500 rows within individual transactions
3. Each batch:
   a. Begin transaction
   b. Insert/update/merge records
   c. Write audit log entries
   d. Update import_job progress
   e. Commit transaction
4. If a batch fails:
   a. Rollback that batch
   b. Mark failed rows in import_rows
   c. Continue with next batch (or pause, depending on error type)
5. Status: 'completed' | 'completed_with_errors' | 'failed'
```

**Phase 3: Rollback (if needed)**
```
1. Query all records created/modified by this import_job_id
2. For creates: soft-delete the records
3. For updates: restore previous values from change_history
4. For merges: un-merge using stored pre-merge snapshots
5. Status: 'rolled_back'
```

### Key Design Decisions

- **Batch size**: 100-500 rows per transaction. Small enough to avoid lock contention, large enough to amortize transaction overhead.
- **Error handling**: Distinguish between recoverable errors (bad data in one row) and fatal errors (database connection lost). Continue on recoverable, pause on fatal.
- **Idempotency**: Each batch should be safe to retry. Use import_job_id + row_number as a dedup key.
- **Progress tracking**: Update import_job with processed_count, success_count, error_count after each batch. Enable real-time UI progress.
- **Compensating transactions**: For rollback, store enough information to reverse every operation. This means capturing pre-update snapshots for modified records.

---

## 8. CDC (Change Data Capture) Patterns

### Core CDC Methods

| Method | How It Works | Latency | Overhead | Accuracy |
|--------|-------------|---------|----------|----------|
| **Log-based** | Parse database transaction logs (WAL) | Real-time | Very low | Perfect |
| **Trigger-based** | Database triggers fire on INSERT/UPDATE/DELETE | Real-time | Moderate | Perfect |
| **Timestamp-based** | Poll for records with updated_at > last_check | Near-real-time | Low | Can miss deletes |
| **Diff-based** | Compare full table snapshots | Batch | High | Complete |

### For CRM Imports: Trigger + Application-Level CDC

Since the Whop CRM is a single application (not a distributed system), full log-based CDC (Debezium/Kafka) is overkill. The right approach is **application-level CDC**:

**What to capture for every change**:
```
{
  entity_type: 'contact',
  entity_id: 'crm_abc123',
  operation: 'UPDATE',
  changed_fields: {
    email: { old: 'bob@old.com', new: 'bob@new.com' },
    company_id: { old: null, new: 'crm_xyz789' }
  },
  source: 'import',           // 'manual' | 'import' | 'api' | 'merge' | 'system'
  source_id: 'import_job_42', // links to the specific import
  actor_id: 'user_123',
  timestamp: '2026-03-06T...',
  reason: 'CSV import: contacts_march.csv'
}
```

**Import-specific CDC requirements**:
- **Batch correlation**: Every change from an import shares an `import_job_id`, making it trivial to query "what did import #42 change?"
- **Before/after snapshots**: For updates and merges, store the complete before-state so rollback is possible
- **Source attribution**: Was this field set by the import, or was it already in the system? Critical for survivorship rules.
- **Conflict detection**: If a field was manually edited by a user AND the import tries to overwrite it, flag the conflict

### Queryable Change History

Design the change_history table for the queries you'll actually run:
- "Show me everything that changed in import #42"
- "Who last modified this contact's email?"
- "What did this record look like on January 15th?"
- "How many records has user X modified this month?"
- "What fields change most frequently?" (data quality signal)

---

## 9. Canonical Data Models

### What Is a Canonical Model?

A canonical data model (CDM) is a standardized, simplified representation of data entities that serves as the single source of truth. Instead of every integration mapping directly to every other system (n-squared complexity), each system maps to/from the canonical model (2n complexity).

### CRM Contact Canonical Model

Based on best practices across Salesforce, HubSpot, and enterprise CRM research:

```
CanonicalContact {
  // Identity
  id: CRM-generated unique ID
  external_ids: Map<source, id>     // { salesforce: 'abc', hubspot: '123' }

  // Name (normalized)
  name: {
    prefix: string | null           // Mr., Dr., etc.
    first: string                   // Normalized (trimmed, proper case)
    middle: string | null
    last: string
    suffix: string | null           // Jr., III, etc.
    full: string                    // Computed: "Dr. John A. Smith Jr."
    display: string                 // User-preferred display name
  }

  // Contact Points (multi-valued, typed)
  emails: [{
    address: string                 // Normalized (lowercase, trimmed)
    type: 'work' | 'personal' | 'other'
    is_primary: boolean
    verified: boolean
    source: string                  // Where this email came from
  }]

  phones: [{
    number: string                  // E.164 format: +15551234567
    type: 'work' | 'mobile' | 'home' | 'other'
    is_primary: boolean
    source: string
  }]

  // Professional
  title: string | null
  department: string | null
  company_id: reference
  linkedin_url: string | null

  // Location
  address: {
    street1: string | null
    street2: string | null
    city: string | null
    state: string | null            // ISO 3166-2 code
    postal_code: string | null
    country: string                 // ISO 3166-1 alpha-2
  }

  // Metadata
  source: string                    // Original source of record
  owner_id: reference               // Assigned user
  lifecycle_stage: enum
  tags: string[]
  custom_fields: Map<field_id, typed_value>

  // System
  created_at: timestamp
  updated_at: timestamp
  created_by: reference
  last_activity_at: timestamp
  merged_from: id[] | null          // IDs of records merged into this one
}
```

### CRM Company Canonical Model

```
CanonicalCompany {
  id: CRM-generated unique ID
  external_ids: Map<source, id>

  // Identity
  name: string                      // Normalized legal/common name
  aliases: string[]                  // Alternate names, DBAs, former names
  domain: string | null              // Primary web domain (normalized, no www)
  domains: string[]                  // All known domains

  // Classification
  industry: string | null            // Standardized industry code
  type: 'prospect' | 'customer' | 'partner' | 'vendor' | 'other'
  size: string | null                // Employee range
  revenue: number | null             // Annual revenue estimate

  // Location (HQ)
  address: { ... }                   // Same structure as contact

  // Social
  linkedin_url: string | null
  twitter_handle: string | null
  website: string | null

  // Relationships
  parent_company_id: reference | null
  child_company_ids: reference[]

  // Metadata
  source: string
  owner_id: reference
  tags: string[]
  custom_fields: Map<field_id, typed_value>

  // System
  created_at: timestamp
  updated_at: timestamp
}
```

### Normalization Rules for the Canonical Model

| Field | Normalization |
|-------|--------------|
| Email | Lowercase, trim whitespace, validate format |
| Phone | Parse to E.164 format (+country code + number) |
| Name | Trim, proper case, handle prefixes/suffixes |
| Company name | Trim, normalize legal suffixes (LLC, Inc, Ltd), handle "The" prefix |
| Domain | Lowercase, remove protocol/www/trailing slash |
| Country | Normalize to ISO 3166-1 alpha-2 |
| State/Province | Normalize to ISO 3166-2 |
| URL | Normalize protocol, remove tracking params |

---

## 10. Open-Source Entity Resolution Tools

### Tool Comparison

| Feature | Splink | Zingg | Dedupe.io | RecordLinkage |
|---------|--------|-------|-----------|---------------|
| **Language** | Python | Python (Spark) | Python | Python/R |
| **Model** | Fellegi-Sunter (probabilistic) | ML-based (active learning) | Active learning | Multiple |
| **Training data needed** | None (unsupervised) | 40-50 labeled pairs | Some labeled pairs | Varies |
| **Scale** | Millions (SQL backends) | Millions (Spark) | Thousands-millions | Thousands |
| **Backends** | DuckDB, Spark, Athena, Postgres | Snowflake, Databricks, S3 | In-memory | In-memory |
| **Blocking** | User-defined rules | ML-learned blocking | Predicate-based | Multiple methods |
| **Output** | Match probability 0-1 | Zingg ID (persistent ID) | Match clusters | Link predictions |
| **Strengths** | No training data, transparent weights, government-proven | Cloud-native, incremental, learned blocking | Simple API, good for small-medium data | Academic, flexible |

### Splink Architecture (Deep Dive)

Splink implements the Fellegi-Sunter model with key innovations:

1. **Unsupervised parameter estimation**: Uses Expectation Maximisation (EM) algorithm to estimate m and u probabilities without labeled training data. This is a major advantage -- you don't need to manually label matches to get started.

2. **Blocking rules**: User defines rules that reduce the comparison space (e.g., "only compare records that share the same first letter of surname"). This is deterministic pre-filtering before probabilistic scoring.

3. **Comparison functions**: Configurable per-field comparisons including exact match, Levenshtein distance, Jaro-Winkler, and custom functions.

4. **SQL backends**: Pushes computation to the database engine (DuckDB, Spark, Postgres, Athena), avoiding memory limitations.

5. **Match weight waterfall charts**: Visual explanation of WHY two records matched -- which fields contributed how much evidence. Excellent for reviewer UX.

### Zingg Architecture (Deep Dive)

Zingg takes a different approach:

1. **Active learning**: Users label 40-50 pairs as "match" / "not match" / "unsure." The ML model trains on these labels to learn field-specific matching logic.

2. **Learned blocking**: Unlike Splink where blocking rules are manual, Zingg's AI learns optimal blocking strategies. This means it "does not compare every record with every other record" -- comparisons are 0.05-1% of the possible space.

3. **Zingg ID**: Generates a globally unique, persistent identifier per resolved entity. This is the canonical ID that survives across systems.

4. **Incremental processing**: New records are matched against existing resolved entities without full reprocessing.

5. **Privacy-first**: Models train directly on user data without external API calls.

### What We Can Learn for Whop CRM

**From Splink**:
- The Fellegi-Sunter model is mathematically sound and well-understood. The m/u probability framework gives interpretable, tunable confidence scores.
- Waterfall charts showing per-field contribution to match score are excellent UX for review queues.
- Unsupervised training means the system works immediately without labeled data.

**From Zingg**:
- Learned blocking is more adaptive than manual rules. Consider using AI to suggest blocking strategies.
- Persistent entity IDs (Zingg ID) is a powerful concept -- a canonical ID that represents the resolved entity across all sources.
- Incremental processing is essential for imports -- don't re-resolve the entire database for each new batch.

**From Dedupe**:
- Active learning with human-in-the-loop labeling is practical for bootstrapping a matching model.
- The "label a few examples, then let the model generalize" pattern maps well to the CRM review queue.

---

## 11. Recommendations for Whop CRM

### Architecture Summary

Based on this research, here are the specific recommendations for the Whop CRM data integrity layer, ordered by impact and feasibility:

### Tier 1: High Impact, Feasible Now

**1. Two-Phase Import with Staging**
- Store raw import data in `import_rows` table before any processing
- Never lose original data -- enables re-processing and re-mapping
- Validate in stages: parse -> field rules -> cross-field rules -> entity resolution
- Batch commit in groups of 200-500 rows with per-batch transactions
- Track import_job_id on every created/modified record for rollback capability

**2. Layered Entity Resolution**
- Deterministic pass first: exact email, exact phone, exact external ID = auto-merge
- Probabilistic pass second: weighted scoring on name + company + domain
- Use Fellegi-Sunter-inspired weights (not just fuzzy string distance) for interpretable scores
- Three zones: auto-merge (>90%), review (60-90%), auto-reject (<60%)

**3. Comprehensive Change History**
- Every mutation (manual, import, merge, API) writes to change_history
- Include: entity_type, entity_id, field, old_value, new_value, source, source_id, actor, timestamp
- Import changes are correlated by import_job_id for batch rollback
- Store pre-update snapshots for merge operations

**4. Review Queue UX**
- Side-by-side comparison with field-level color coding (match/similar/conflict)
- Batch review grouped by match type
- One-click merge/reject actions
- Show confidence score waterfall (which fields drove the score)
- Feedback loop: track reviewer decisions to tune thresholds

### Tier 2: Medium Impact, Moderate Effort

**5. Canonical Data Normalization**
- Define canonical formats for all fields (E.164 phones, lowercase emails, ISO country codes)
- Normalize on write, store original in change_history
- Multi-valued contact points (multiple emails, multiple phones) with primary flag
- Company alias tracking for matching

**6. Validation Pipeline as Code**
- Define validation rules declaratively (inspired by Great Expectations / Soda)
- Stage validations: required fields -> format checks -> referential integrity -> business rules -> anomaly detection
- Generate per-import validation reports
- Track validation metrics over time

**7. Import Rollback Capability**
- Every record created by an import carries the import_job_id
- Rollback = soft-delete all created records + restore previous values for updated records
- Pre-merge snapshots enable un-merging
- Rollback is itself logged as an event in change_history

### Tier 3: Future Enhancements

**8. Probabilistic Matching Model**
- Implement Fellegi-Sunter m/u parameter estimation using EM algorithm
- Per-field match weights based on actual data distribution (not just heuristics)
- Unsupervised -- no labeled training data needed
- Adaptable as data patterns change

**9. Learned Blocking**
- Use AI to suggest which records to compare (instead of comparing all pairs)
- Reduces entity resolution from O(n^2) to O(n) in practice
- Essential once the database exceeds ~50K contacts

**10. Event Sourcing for Critical Paths**
- Consider event sourcing for deal pipeline (stage transitions are natural events)
- Not recommended for general contact/company CRUD (too much complexity for the benefit)
- Hybrid: CRUD + change log for most entities, event sourcing for pipeline/deals

### Anti-Patterns to Avoid

- **Single giant transaction for imports**: Will lock the database and timeout. Use batched transactions.
- **Binary match/no-match**: Always use a confidence spectrum with configurable thresholds.
- **Losing raw import data**: Always keep the original CSV data in staging. Never transform in place.
- **Silent merges**: Every auto-merge should be logged and reversible. Users should be able to see "these records were auto-merged with 95% confidence."
- **Ignoring field-level provenance**: Track which source set which field value. Critical for survivorship rules.
- **Over-engineering with full event sourcing**: For a single-app CRM, a change log table gives you 90% of the benefit at 20% of the complexity.

---

## Sources

### Event Sourcing & CQRS
- [Event Sourcing Explained: Pros, Cons & Strategic Use Cases (2025)](https://www.baytechconsulting.com/blog/event-sourcing-explained-2025)
- [Event Sourcing Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Event Sourcing Pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html)
- [Mastering CQRS and Event Sourcing - RisingWave](https://risingwave.com/blog/mastering-cqrs-and-event-sourcing-for-modern-database-architecture/)
- [1 Year of Event Sourcing and CQRS](https://itnext.io/1-year-of-event-sourcing-and-cqrs-fb9033ccd1c6)

### Immutable Data Patterns
- [Immutable Databases: The Evolution of Data Integrity](https://www.navicat.com/en/company/aboutus/blog/3347-immutable-databases-the-evolution-of-data-integrity.html)
- [Datomic Temporal Modeling in Clojure](https://clojurepatterns.com/21/9/2/)
- [Datomic: Event Sourcing Without the Hassle](https://vvvvalvalval.github.io/posts/2018-11-12-datomic-event-sourcing-without-the-hassle.html)

### Schema-on-Read vs Schema-on-Write
- [Schema-on-Read vs Schema-on-Write (Dec 2025)](https://osamadev.medium.com/schema-on-read-vs-schema-on-write-understanding-the-difference-f5bc56ea7f31)
- [Schema-on-Read vs Schema-on-Write - Dremio](https://www.dremio.com/wiki/schema-on-read-vs-schema-on-write/)
- [Data Management: Schema-on-Write vs Schema-on-Read - RisingWave](https://risingwave.com/blog/data-management-schema-on-write-vs-schema-on-read/)

### Data Validation Pipelines
- [dbt vs Great Expectations vs Soda: Which Data Quality Tool](https://cybersierra.co/blog/best-data-quality-tools/)
- [2026 Open-Source Data Quality and Observability Landscape](https://datakitchen.io/the-2026-open-source-data-quality-and-data-observability-landscape/)
- [Building Robust Data Pipelines with dbt, Airflow, and Great Expectations](https://www.getdbt.com/blog/building-a-robust-data-pipeline-with-dbt-airflow-and-great-expectations)

### Confidence Scoring & Entity Resolution
- [What is Entity Resolution? Use Cases and Best Practices](https://www.rudderstack.com/blog/what-is-entity-resolution/)
- [Accelerating Entity Resolution with Automation and Human Validation](https://www.dataiku.com/stories/blog/accelerating-entity-resolution)
- [The Ultimate Guide to Data Matching and Merging](https://matchdatapro.com/the-ultimate-guide-to-data-matching-and-merging/)
- [Data Engineer's Guide to Entity Resolution](https://www.peopledatalabs.com/data-lab/datafication/entity-resolution-guide)
- [The Fellegi-Sunter Model - Splink](https://moj-analytical-services.github.io/splink/topic_guides/theory/fellegi_sunter.html)
- [Probabilistic vs Deterministic Linkage - Splink](https://moj-analytical-services.github.io/splink/topic_guides/theory/probabilistic_vs_deterministic.html)

### Human-in-the-Loop Review Queues
- [Human-in-the-Loop AI Review Queues: Workflow Patterns That Scale (2025)](https://alldaystech.com/guides/artificial-intelligence/human-in-the-loop-ai-review-queue-workflows)
- [Human-in-the-Loop for AI Agents: Best Practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo)
- [Smart HITL Integration for CRM, ERP and EMR Systems](https://www.moxo.com/blog/integrating-human-in-the-loop-automation)

### Transactional Imports & Saga Pattern
- [Saga Pattern in Microservices - Temporal](https://temporal.io/blog/mastering-saga-patterns-for-distributed-transactions-in-microservices)
- [Building a Reliable Rollback System with SAGA, Event Sourcing and Outbox](https://medium.com/@mehhmetoz/building-a-reliable-rollback-system-with-saga-event-sourcing-and-outbox-patterns-0477e713b010)
- [Atomicity in Databases - DataCamp](https://www.datacamp.com/tutorial/atomicity)

### CDC (Change Data Capture)
- [How Change Data Capture Works - Confluent](https://www.confluent.io/blog/how-change-data-capture-works-patterns-solutions-implementation/)
- [What is Change Data Capture? - Striim](https://www.striim.com/blog/change-data-capture-cdc-what-it-is-and-how-it-works/)
- [CDC Adoption Stats 2026 - Integrate.io](https://www.integrate.io/blog/cdc-change-data-capture-adoption-stats/)

### Canonical Data Models
- [Canonical Data Model: Definition, Benefits, Design](https://recordlinker.com/canonical-data-model/)
- [Canonical Data Models Explained - Alation](https://www.alation.com/blog/canonical-data-models-explained-benefits-tools-getting-started/)
- [Canonical Data Model - Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CanonicalDataModel.html)
- [Common Data Model - Microsoft](https://learn.microsoft.com/en-us/common-data-model/)

### Open-Source Entity Resolution Tools
- [Splink - GitHub](https://github.com/moj-analytical-services/splink)
- [Zingg - Open Source Identity Resolution](https://www.zingg.ai/)
- [Zingg - GitHub](https://github.com/zinggAI/zingg)
- [Awesome Entity Resolution - GitHub](https://github.com/OlivierBinette/Awesome-Entity-Resolution)
