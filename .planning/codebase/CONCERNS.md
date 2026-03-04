# Codebase Concerns — Whop CRM

> Last updated: 2026-03-04
> Source: Code analysis + AGENT-SPECS.md section 6

---

## 1. Known Bugs (from AGENT-SPECS.md §6 + code verification)

### BUG-01: Contact form missing fields
**File:** `src/components/contacts/contact-form.tsx`
The create form only exposes: `firstName`, `lastName`, `email`, `phone`, `type`, `source`, `linkedinUrl`.
`createContactSchema` (and `updateContactSchema`) also support: `status`, `tier`, `twitterUrl`, `websiteUrl`, `ownerId`.
New contacts are always created with `status = "prospect"` (DB default) and no tier, owner, or social links beyond LinkedIn.

### BUG-02: Task form missing fields
**File:** `src/app/(dashboard)/tasks/page.tsx` (inline create dialog)
The create dialog only exposes: `title`, `priority`, `dueDate`.
`createTaskSchema` also supports: `description`, `contactId`, `dealId`, `assigneeId`.
Tasks are created with `assigneeId = creatorId` (API default) because the UI never sends an explicit assignee, making the assignee field in the list page always show the current user.

### BUG-03: Deal form missing fields
**File:** `src/components/pipeline/deal-form.tsx`
The form exposes: `title`, `contactId`, `stageId`, `priority`, `value`, `expectedCloseDate`, `description`.
`createDealSchema` also supports: `companyId`, `expectedMrr`.

### BUG-04: Custom field `multi_select` excluded from settings UI
**File:** `src/app/(dashboard)/settings/page.tsx` (`CustomFieldsSettings` component)
The field type selector in the create dialog lists: text, number, date, boolean, url, email, currency, select.
`multi_select` is a valid enum value in the DB schema and `fieldTypeEnum` but is missing from the dropdown. Any `multi_select` fields in the DB cannot be edited via the UI.

### BUG-05: Saved view delete button missing
**File:** `src/app/(dashboard)/contacts/page.tsx`
`useDeleteSavedView` hook is imported and available in the hook file (`src/lib/hooks/use-saved-views.ts`) but there is no delete button rendered in the saved views bar UI. Users can create saved views but cannot remove them.

### BUG-06: Contact detail — Deals tab is static placeholder
**File:** `src/app/(dashboard)/contacts/[id]/page.tsx` (lines 306–320)
The Deals tab renders a hardcoded string `"No deals yet. Create one from the pipeline view."` regardless of actual deal data. The API at `GET /api/deals?contactId=<id>` exists and works correctly.

### BUG-07: Contact detail — Tasks tab is static placeholder
**File:** `src/app/(dashboard)/contacts/[id]/page.tsx` (lines 322–336)
Same issue as BUG-06 for Tasks. Returns `"No tasks yet. Create one to track follow-ups."` unconditionally. The API at `GET /api/tasks?contactId=<id>` exists and works.

### BUG-08: Pipeline settings is read-only
**File:** `src/app/(dashboard)/settings/page.tsx` (`PipelinesSettings` component)
The Pipelines tab renders a read-only visual flow of stages with no create/edit/delete controls. The pipeline API only exposes `GET /api/pipeline` — there are no mutation endpoints. `src/lib/api/pipelines.ts` has no write functions beyond the internal `seedDefaultPipelines`.

### BUG-09: No GET endpoint for single task
**File:** `src/app/api/tasks/[id]/route.ts`
The route file only exports `PATCH` and `DELETE`. There is no `GET` handler. Fetching a single task by ID is impossible via the API. This will block future task detail pages and edit prefill.

### BUG-10: Audit log `entityType` filter runs in application layer
**File:** `src/lib/api/audit-log.ts` (lines 72–78)
When `entityType` filter is provided, the code fetches up to `limit` rows from the DB (all typed `system_event`) then filters them in JavaScript. If the first `limit=50` rows don't contain the requested entity type, the response returns fewer rows than expected. The filter should be pushed to the SQL `WHERE` clause using a JSONB operator.

---

## 2. Incomplete Features (partially functional)

### INC-01: Contact editing — no UI
**API:** `PATCH /api/contacts/:id` — works
**Hook:** `useUpdateContact` in `src/lib/hooks/use-contacts.ts` — exists
**Missing:** Edit dialog or inline form. The contact detail page (`src/app/(dashboard)/contacts/[id]/page.tsx`) has no Edit button. The contacts list (`src/app/(dashboard)/contacts/page.tsx`) has no Edit option in the row dropdown menu.

### INC-02: Deal editing — no UI
**API:** `PATCH /api/deals/:id` — works
**Hook:** `useUpdateDeal` in `src/lib/hooks/use-deals.ts` — exists
**Missing:** Edit dialog. The `src/components/pipeline/deal-form.tsx` only handles create. Deals list row dropdown only shows Delete.

### INC-03: Task editing — no UI
**API:** `PATCH /api/tasks/:id` — works
**Hook:** `useUpdateTask` in `src/lib/hooks/use-tasks.ts` — exists
**Missing:** Edit dialog. Tasks page row dropdown only shows Delete. Status toggle (checkbox) is the only mutation available from the UI.

### INC-04: Activity editing and deletion — no API or UI
**File:** `src/app/api/activities/route.ts` — only `GET` and `POST`
No `PATCH` or `DELETE` handler exists for individual activities. Activities can be created from the timeline but never corrected or removed. The `src/lib/api/activities.ts` data layer has no `updateActivity` or `deleteActivity` functions.

### INC-05: Companies entity — schema exists, zero implementation
**Schema:** `companies`, `contactCompanies` tables defined in `src/lib/db/schema.ts`
**Missing:** All of `src/lib/api/companies.ts`, `src/app/api/companies/`, `src/lib/hooks/use-companies.ts`, `src/components/companies/`, `src/app/(dashboard)/companies/` page files, validator, and sidebar link. The `contact_companies` junction table is also entirely unused.

### INC-06: User / team management — no API or UI
**Schema:** `users` table supports `role` and `isActive` fields
**Missing:** `src/lib/api/users.ts`, `GET /api/users`, `PATCH /api/users/:id`, settings tab or page for managing team members. There is no way for an admin to change another user's role or deactivate a user via the app.

### INC-07: Custom field `select` type — no options configuration
**File:** `src/app/(dashboard)/settings/page.tsx`
When creating a custom field of type `select`, the dialog does not expose an options editor. The `options` column in `custom_field_definitions` remains `null`. The display component (`src/components/contacts/custom-fields-display.tsx`) also does not render select fields as a dropdown — it falls through to the generic text input path.

### INC-08: Saved views — contacts only
**File:** `src/app/(dashboard)/contacts/page.tsx`
Saved views are wired up only for the contacts list. The `savedViews` schema supports `entity_type` enum values `contact`, `deal`, `company`, `task`, but no other list page has the save/load bar or hooks.

### INC-09: Health score recalculation — no trigger
**File:** `src/lib/whop/health-score.ts`
`recalculateAllHealthScores()` is a well-implemented function but there is no cron job, API endpoint, or UI trigger to call it. Health scores in the database are only updated if set manually via the PATCH contact endpoint. The portfolio page and dashboard therefore show stale or null scores.

### INC-10: Bulk operations — API exists, no UI
**File:** `src/app/api/bulk/route.ts`
The bulk API supports `reassign_contacts`, `bulk_stage_change`, and `import_contacts` actions. None of these are accessible from the UI. There are no row selection checkboxes on the contacts or deals list pages.

### INC-11: Audit log — no page
**API:** `GET /api/audit-log` — works
**Hook:** `useAuditLog` in `src/lib/hooks/use-audit-log.ts` — exists
**Missing:** Any UI page to view audit log entries. Noted in AGENT-SPECS.md §5.15.

### INC-12: Command palette — contacts and deals only
**File:** `src/components/layout/command-palette.tsx`
Search results from `GET /api/search` only return contacts and deals (hardcoded in both the API and palette). Companies, tasks, and quick-create actions are absent.

---

## 3. Technical Debt

### TD-01: Inline type annotations on component props instead of interfaces
**Files:** `src/app/(dashboard)/tasks/page.tsx`, `src/app/(dashboard)/deals/page.tsx`, `src/app/(dashboard)/settings/page.tsx`
Map callbacks inline-annotate the row shape directly in the `.map()` call (e.g. `task: { id: string; title: string; ... }`). These should be derived from the data layer return types or Drizzle `$inferSelect`, not hand-rolled inline. When the schema changes, these inline annotations will silently fall out of sync.

### TD-02: `getContact` makes 3 sequential database round-trips
**File:** `src/lib/api/contacts.ts` (lines 113–141)
`getContact` runs: (1) select contact, (2) conditionally select owner, (3) select tags. These should be a single query using Drizzle's relational `with` API or explicit joins. At minimum, steps 1 and 2 can be collapsed into a left join.

### TD-03: `listPipelines` loads all stages then filters in JS
**File:** `src/lib/api/pipelines.ts` (lines 5–21)
`listPipelines` fetches all pipelines and all stages as two separate queries, then calls `Array.filter()` in JavaScript to pair them. As stage count grows, this is wasteful. It should use a join or Drizzle's relational query with `with: { stages: true }`.

### TD-04: `recalculateAllHealthScores` has N+1 query pattern
**File:** `src/lib/whop/health-score.ts` (lines 80–173)
The function iterates over every active creator in a `for` loop and fires 2 DB queries per creator (GMV snapshots, last activity). For 1000 creators this is 2000 queries. This should bulk-fetch snapshots and activities, then process in memory.

### TD-05: `logAuditEvent` misuses the activities table
**File:** `src/lib/api/audit-log.ts`
Audit events are stored as `system_event` activity records with JSON metadata, conflating two concerns. The `entityType` filter cannot be pushed to SQL (see BUG-10). A dedicated `audit_log` table would be cleaner, but a near-term improvement is adding a JSONB index and using a SQL JSONB path operator for the filter.

### TD-06: Database connection is not pooled
**File:** `src/lib/db/index.ts`
`postgres(connectionString)` creates a new connection pool but with default settings — no explicit `max`, `idle_timeout`, or `connect_timeout` configuration. In a serverless environment (Vercel + Railway), unbounded connections can exhaust the Railway connection limit. Should set `max: 10` or use PgBouncer.

### TD-07: No `staleTime` on React Query hooks
**Files:** Most hook files in `src/lib/hooks/`
AGENT-SPECS.md specifies `staleTime: 30_000` as a convention but most hooks use the default `staleTime: 0`, causing unnecessary re-fetches on every window focus. Only needs a one-line fix per hook but should be applied uniformly.

### TD-08: `authPath` mismatch in proxy vs. spec
**File:** `src/proxy.ts`
The file is named `proxy.ts` per the Next.js 16 convention but the Clerk middleware uses `clerkMiddleware` from `@clerk/nextjs/server` — which is still the standard approach. The filename `proxy.ts` is a cosmetic deviation; the actual export is `clerkMiddleware`. No functional issue but confusing for contributors.

### TD-09: CSV export has no escaping for double-quotes in values
**File:** `src/app/api/bulk/route.ts` (lines 116–127)
The CSV serialiser only wraps values in quotes if they contain a comma. Values that contain a double-quote character (e.g. a company description with `"quoted text"`) will produce malformed CSV that breaks most parsers. Standard RFC 4180 requires doubling embedded quotes: `"say ""hello"""`.

### TD-10: Error messages from `requireUser` are strings, not typed errors
**Files:** All API route handlers
Every route catches `error instanceof Error && error.message === "Unauthorized"` to distinguish auth failures. This is brittle — any other error with message `"Unauthorized"` will be treated as an auth error, and future refactors of the auth helper could silently break the pattern. Should use a typed `AuthError` class or HTTP status code check.

---

## 4. Security Concerns

### SEC-01: No ownership validation on PATCH/DELETE mutations
**Files:** `src/app/api/contacts/[id]/route.ts`, `src/app/api/deals/[id]/route.ts`, `src/app/api/tasks/[id]/route.ts`
All mutation routes call `requireUser()` to confirm authentication but do not verify that the authenticated user owns the record being modified. An `ae` user who knows another user's contact UUID can PATCH or DELETE it. Role-based scoping on `GET` (restricting `ownerId`) is not mirrored on write operations.

### SEC-02: Bulk API has no input validation or size limits
**File:** `src/app/api/bulk/route.ts`
The `PATCH` handler reads `body.contactIds` as an array and passes it directly to `inArray()`. There is no validation of array length. A malicious or misbehaving client could submit an array of thousands of UUIDs, triggering a mass-reassignment. Should validate with Zod and enforce a max batch size (e.g. 500 records).

### SEC-03: CSV import accepts arbitrary data without schema validation
**File:** `src/app/api/bulk/route.ts` (lines 56–74)
`import_contacts` iterates `body.contacts` and calls `createContact(row)` for each item. The `createContact` function itself expects a validated `CreateContactInput`, but the route passes raw `row` objects directly without running them through `createContactSchema.safeParse`. A crafted request can inject unexpected fields.

### SEC-04: No rate limiting on any API route
All API routes are unprotected against brute-force or abuse. The `/api/search` endpoint in particular runs two full-text ILIKE queries on every keystroke (debounced client-side to 200ms but no server-side rate limit). Should implement request rate limiting at the Vercel edge or via a middleware wrapper.

### SEC-05: Audit log is accessible to all authenticated users
**File:** `src/app/api/audit-log/route.ts`
The audit log GET route calls `requireUser()` without checking role. Any `ae` user can read the full audit trail of all actions by all users. Should restrict to `admin` and `manager` roles using `requireRole`.

### SEC-06: No CSRF protection on state-mutating API routes
All mutation routes (`POST`, `PATCH`, `DELETE`) rely solely on Clerk's session cookie for auth. Next.js App Router with `clerkMiddleware` does not automatically add CSRF token validation. For internal tools this risk is lower, but should be noted.

---

## 5. Performance Concerns

### PERF-01: No index on `activities.type` column
**File:** `src/lib/db/schema.ts`
The audit log query filters on `eq(activities.type, "system_event")` across potentially millions of rows. There is no index on `activities.type`. The existing indexes cover `(contactId, occurredAt)` and `(dealId, occurredAt)` but not type alone.

### PERF-02: `getContact` N+1 for owner on list page
**File:** `src/lib/api/contacts.ts`
`listContacts` already joins the owner user in the list query (correct). However, `getContact` (used on the detail page) makes a second query for the owner separately (lines 123–130). Minor but inconsistent.

### PERF-03: Dashboard runs 6 parallel queries with no caching
**File:** `src/app/api/dashboard/route.ts`
Six `Promise.all` queries run on every dashboard load. Each request is unauthenticated-cache-ineligible by design (user-scoped). There is no server-side cache TTL. With multiple concurrent users, this generates significant DB load for what is largely a read-heavy view.

### PERF-04: Analytics route runs 6 sequential groups with no pagination
**File:** `src/app/api/analytics/route.ts`
All analytics queries aggregate over unbounded row sets (all contacts, all deals, last 6 months of activities). As data grows, `activitiesByType` and `activityTrend` queries over millions of rows will degrade. Should add date-range parameters and consider materialized views or pre-aggregation.

### PERF-05: `listTasks` has no pagination
**File:** `src/lib/api/tasks.ts`
`listTasks` returns all matching tasks without a `LIMIT` or `OFFSET`. For a team with thousands of tasks, this will return the entire result set in a single response. Should mirror the paginated pattern used in `listContacts`.

### PERF-06: `listDeals` has no pagination
**File:** `src/lib/api/deals.ts`
Same issue as PERF-05. `listDeals` fetches all matching deals without limit. The deals page will load unbounded data.

### PERF-07: Missing index on `gmv_snapshots.contact_id` + `date`
**File:** `src/lib/db/schema.ts`
`gmvSnapshots` has a unique constraint on `(contactId, date)` and an index on `date` alone (`idx_gmv_snapshots_date`). The health-score query filters on `(contactId, date >= ...)` — this benefits from a composite index `(contactId, date)` that doesn't exist. The unique constraint covers equality but not range queries efficiently.

---

## 6. Missing Infrastructure

### INF-01: No test suite
There are zero test files in the project. No unit tests, no integration tests, no end-to-end tests. Given that this is a CRM for a production internal tool, at minimum the data layer functions (`listContacts`, `createDeal`, `updateTask`, etc.) and auth helpers should have unit tests.

### INF-02: No error tracking / observability
There is no Sentry, Datadog, or similar error tracking integration. All errors are logged to `console.error`. In production, unhandled exceptions and DB errors are invisible unless actively checking Vercel logs.

### INF-03: No cron job infrastructure
The health score recalculation function (`recalculateAllHealthScores`) is designed to run daily but there is no scheduled trigger. No Vercel cron configuration (`vercel.json`), no external cron service, and no `/api/cron/health-scores` endpoint that could be invoked by a scheduler.

### INF-04: No environment variable validation at startup
**File:** `src/lib/db/index.ts`
`DATABASE_URL` is accessed with a non-null assertion (`process.env.DATABASE_URL!`). If the variable is missing, the app will fail at runtime with a cryptic postgres connection error rather than a clear startup error. Should use a Zod env schema or a startup check that provides a useful message.

### INF-05: No seed script for development
Beyond the `seedDefaultPipelines` function (called lazily on first pipeline GET), there is no development seed script. New contributors must manually create contacts, deals, and users to explore the app. Should have a `npm run db:seed` script.

### INF-06: No `.env.example` file
There is no `.env.example` documenting the required environment variables (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`). New developers must infer these from the codebase.

### INF-07: No database migration strategy for production
`drizzle.config.ts` uses `push` mode for schema synchronization (per AGENT-SPECS.md §8). `drizzle-kit push` is suitable for development but destructive in production — it can silently drop columns. A migration-file-based workflow (`drizzle-kit generate` + `migrate`) should be used for production deployments.

---

## 7. Prioritized Action List

Ordered by impact × risk, combining all categories above:

### Critical (blocks core CRM function)

1. **SEC-01** — Add ownership validation to PATCH/DELETE routes. Any authenticated user can currently modify any record.
2. **BUG-06 + BUG-07** — Wire up Deals and Tasks tabs on contact detail. These are empty placeholders when the APIs already work.
3. **INC-01** — Build contact edit UI. PATCH API and hook exist; only the form is missing.
4. **INC-02** — Build deal edit UI. Same situation as contact edit.
5. **BUG-09** — Add GET handler to `src/app/api/tasks/[id]/route.ts`.

### High Priority (daily usability gaps)

6. **INC-03** — Build task edit UI (full form with assignee, contact, deal, description).
7. **INC-05** — Implement Companies CRUD (schema exists, nothing else does).
8. **INC-06** — Implement user/team management (required for user pickers everywhere).
9. **BUG-08** — Make pipeline settings writable (create/edit/delete pipelines and stages).
10. **INC-04** — Add activity edit/delete API and UI.
11. **SEC-02 + SEC-03** — Add Zod validation and size limits to bulk API.

### Medium Priority (correctness and stability)

12. **INF-07** — Switch to Drizzle migration files for production schema changes.
13. **TD-04** — Fix N+1 health score recalculation before it becomes a performance problem.
14. **INF-03** — Create a `/api/cron/health-scores` endpoint and configure a daily trigger.
15. **PERF-05 + PERF-06** — Add pagination to `listTasks` and `listDeals`.
16. **TD-06** — Set explicit postgres connection pool limits.
17. **SEC-05** — Restrict audit log access to admin/manager roles.
18. **BUG-10** — Push `entityType` filter to SQL in audit log query.

### Lower Priority (polish and developer experience)

19. **BUG-01–03** — Expose missing fields in contact, task, and deal create forms.
20. **BUG-04** — Add `multi_select` to custom field type dropdown.
21. **BUG-05** — Add delete button to saved views bar.
22. **INC-07** — Add options editor for `select` custom fields.
23. **INF-04** — Add startup env var validation.
24. **INF-06** — Add `.env.example`.
25. **INF-01** — Begin adding tests, starting with data layer functions.
26. **INF-02** — Add Sentry or equivalent error tracking.
27. **TD-01** — Replace inline map annotations with typed interfaces.
28. **TD-07** — Apply `staleTime: 30_000` to all React Query hooks.
29. **TD-09** — Fix CSV double-quote escaping.
30. **PERF-01** — Add index on `activities.type` column.
