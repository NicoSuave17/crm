# Whop CRM

## What This Is

A custom internal CRM for Whop.com ($1.6B digital marketplace) that manages two core workflows: Creator/Seller Success (account managers tracking portfolios of top creators with GMV, health scores, and churn risk) and Sales Pipeline (outbound prospecting, deal stages, seller onboarding, enterprise partnerships). The core entity is a "creator with live marketplace data" — not a traditional company/contact.

## Core Value

Account managers can efficiently track, manage, and grow their portfolio of Whop creators through a unified interface that combines contact management, deal pipeline, task tracking, and performance analytics.

## Requirements

### Validated

<!-- Shipped and confirmed working — inferred from existing codebase -->

- ✓ Clerk auth flow (sign-in, sign-up, auto-user-creation) — Phase 1
- ✓ Dashboard with 6 KPI cards + recent alerts feed — Phase 1
- ✓ Contacts list with search, type/status filters, pagination, saved views, CSV export — Phase 1
- ✓ Contact create form (firstName, lastName, email, phone, type, source, linkedinUrl) — Phase 1
- ✓ Contact detail page (profile card, health metrics, tags, custom fields, activity timeline) — Phase 1
- ✓ Contact delete — Phase 1
- ✓ Pipeline Kanban board with drag-and-drop stage moves — Phase 1
- ✓ Deal create form (title, contactId, stageId, priority, value, expectedCloseDate, description) — Phase 1
- ✓ Deal detail page — Phase 1
- ✓ Deals list page (table view) — Phase 1
- ✓ Tasks list with create dialog (title, priority, dueDate), status toggle, filters — Phase 1
- ✓ Activity timeline on contact detail (create notes, calls, emails, meetings) — Phase 1
- ✓ Portfolio page (creator card grid with health/GMV/churn risk) — Phase 1
- ✓ Alerts center (view, mark read, filter by severity) — Phase 1
- ✓ Analytics page (6 Recharts visualizations) — Phase 1
- ✓ Settings page (tags CRUD, custom field definitions CRUD, pipeline viewer) — Phase 1
- ✓ Tag selector on contact detail — Phase 1
- ✓ Custom fields display/edit on contact detail — Phase 1
- ✓ Saved views for contacts — Phase 1
- ✓ Bulk CSV export for contacts — Phase 1
- ✓ Command palette (Cmd+K) with search — Phase 1
- ✓ Role-based data scoping (AMs/AEs see own data) — Phase 1
- ✓ Responsive sidebar + mobile sheet nav — Phase 1

### Active

<!-- Current scope — P0, P1, and P2 features from AGENT-SPECS.md -->

#### P0 — Critical
- [ ] Edit Contact Modal with all fields (status, tier, URLs, ownerId, healthScore, whopUsername)
- [ ] Edit Deal Modal with all fields (companyId, expectedMrr, lostReason, description)
- [ ] Edit Task Modal with all fields (description, assigneeId, contactId, dealId)
- [ ] Contact Detail — Deals & Tasks tabs (replace empty placeholders with actual data)
- [ ] User / Team Management (list users, change roles, invite note)
- [ ] User Picker component (searchable select for ownerId/assigneeId fields)
- [ ] Pipeline & Stage Management (full CRUD in settings, drag-to-reorder stages)
- [ ] Company CRUD (full entity: list, detail, create, edit, delete)
- [ ] Contact-Company Linking (junction table UI on both sides)

#### P1 — Important
- [ ] Deal Detail Enhancement (activity timeline, stage history, edit button, tags, custom fields)
- [ ] Searchable Entity Pickers (contact, company, user, deal — Popover + Command pattern)
- [ ] Bulk Operations UI (row selection, reassign, change status, add tag, delete, CSV import)
- [ ] Activity Edit/Delete (PATCH/DELETE API + UI with ownership check)
- [ ] Saved Views for all entities (deals, tasks, companies — not just contacts)
- [ ] Custom Fields — Select Options UI (define options for select/multi_select types)

#### P2 — Nice to Have
- [ ] Audit Log UI page (table with filters)
- [ ] Notification bell in top nav (unread alert count + dropdown)
- [ ] Dashboard Customization (rearrange/hide cards, date range, pipeline selector)
- [ ] Contact/Deal Import Wizard (upload CSV, map columns, preview, import)
- [ ] Email Templates (CRUD in settings, variable interpolation)
- [ ] Advanced Cmd+K (search deals/companies/tasks, recent items, quick actions)

### Out of Scope

- Whop API integration — Phase 4, not in current milestone
- Email/LinkedIn/Intercom integrations — Phase 4
- Real-time notifications (WebSocket) — over-engineering for internal tool
- Mobile native app — web-responsive is sufficient
- Multi-tenant / multi-org — single org internal tool

## Context

- **Existing codebase**: ~718-line Drizzle schema with 18 tables, 23 API routes, full dashboard layout
- **Database**: PostgreSQL on Railway with all tables created
- **PATCH APIs exist** for contacts, deals, and tasks — just missing UI
- **Schema has** companies table, contact_companies junction, deal_tags junction — all unused
- **Known security gap**: PATCH/DELETE routes lack ownership validation (any auth'd user can modify any record)
- **No tests exist** — no test framework installed
- **Codebase map**: Full documentation at `.planning/codebase/`

## Constraints

- **Tech Stack**: Next.js 16 (App Router), Drizzle ORM, Clerk auth, shadcn/ui, React Query — all locked
- **Proxy**: Uses `proxy.ts` not `middleware.ts` (Next.js 16 convention)
- **Database**: Railway PostgreSQL — connection-limited, need pool management
- **UI Kit**: shadcn/ui primitives only — no other component libraries
- **Patterns**: Follow existing conventions exactly (API routes → data layer → hooks → pages)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build user management first | Dependency for user pickers in all edit forms | — Pending |
| Entity pickers before edit forms | Edit forms need contact/company/user/deal pickers | — Pending |
| Follow AGENT-SPECS.md build order | Minimizes blockers via dependency-aware sequencing | — Pending |
| No test infrastructure this milestone | Focus on feature completeness; tests in future milestone | — Pending |
| Fix security gaps during edit form work | Ownership validation needed when building edit UIs | — Pending |

---
*Last updated: 2026-03-04 after initialization*
