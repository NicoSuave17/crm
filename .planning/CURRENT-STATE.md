# Whop CRM — Current State Audit

**Generated:** 2026-03-05

## System Overview

Custom internal CRM for Whop.com. Covers creator/seller success (AM portfolio management) and sales pipeline (outbound seller acquisition + enterprise partnerships).

**Stack:** Next.js 16 (App Router) / TypeScript / Drizzle ORM / PostgreSQL / Clerk Auth / shadcn/ui / React Query / Vercel + Railway

---

## Feature Completeness Matrix

| Feature | Status | % | Critical Gaps |
|---------|--------|---|---------------|
| Authentication | Complete | 95% | Auto-enroll works; Clerk integration solid |
| Authorization (RBAC) | Partial | 70% | Role-based CRUD works; **field-level NOT enforced in PATCH handlers** |
| Contacts CRUD | Complete | 100% | Full CRUD, filtering, search, bulk ops |
| Companies CRUD | Complete | 100% | Full CRUD, filtering, bulk ops |
| Deals CRUD | Complete | 95% | Stage history, checklists functional |
| Pipeline/Kanban | Complete | 90% | Drag-drop, deal creation, stage colors |
| Tasks | Complete | 85% | CRUD OK; **change history not tracked** |
| Activities | Partial | 75% | Create/list works; **no edit endpoint exposed** |
| Change History | Partial | 60% | **Only tracks PATCH; misses bulk ops, tags, custom fields** |
| Audit Log | Partial | 70% | Logs to activities table; admin review OK; **not detailed per-record** |
| Email Templates | Partial | 50% | CRUD exists; **no sending, no placeholder rendering** |
| Alerts | Partial | 40% | Infrastructure exists; **no automated trigger logic** |
| Tags | Complete | 100% | Create/assign/remove globally |
| Custom Fields | Complete | 85% | EAV pattern functional; 9 types |
| Search | Partial | 70% | Basic substring; **no fuzzy/advanced syntax** |
| CSV Import/Export | Partial | 75% | Import with custom fields; **export contacts only** |
| Saved Views | Partial | 60% | Save/load filters; **column persistence just added** |
| Reports | Partial | 50% | Config/execute framework; **limited report types** |
| Admin: Permissions | Complete | 80% | Configure roles; **field-level not enforced** |
| Admin: Navigation | Complete | 90% | Drag-reorder, custom items, role-based |
| Admin: Fields | Complete | 95% | Full CRUD for custom field definitions |
| Teams | Partial | 30% | Tables exist; **filtering untested** |
| Duplicates | Partial | 30% | Detection endpoints exist; **warning UI just added** |
| Merging | Partial | 30% | Endpoints exist; **dialog UI just added** |
| Bulk Operations | Complete | 90% | 17 bulk actions; **not individually audited** |

---

## Permission Architecture (Current)

### Roles (5)
`admin` > `manager` > `account_manager` / `ae` / `enterprise_sales`

### How It Works Today
1. **`withPermission()`** wrapper on API routes checks CRUD permission per (role, entityType)
2. **`recordScope`**: `all` / `own` / `team` — filters which records the user can see/edit
3. **`fieldOverrides`**: JSONB column stores per-(role, entityType, field) access as `hidden`/`readonly`/`editable`
4. **`checkPermission()`** validates action, returns 403 if denied

### What's Missing
- **Field-level enforcement NOT in PATCH handlers** — fieldOverrides are stored but never validated server-side
- **No record-level permissions** — can't grant access to specific records
- **No approval workflows** — all changes are immediate
- **No delegation** — can't temporarily elevate permissions
- **Team scope untested** — code exists but hasn't been verified
- **Tags**: anyone can create/assign (no permission check)
- **Custom field changes**: not tracked in changeHistory

---

## Audit & Change Tracking (Current)

### Two Systems
1. **`changeHistory` table** — field-level: (entityType, entityId, fieldName, oldValue, newValue, userId, changedAt)
2. **`activities` table with type='system_event'** — action-level audit log

### What's Tracked
| Operation | changeHistory | Audit Log |
|-----------|:---:|:---:|
| Contact PATCH | Yes | Yes |
| Deal PATCH | Yes | Yes |
| Company PATCH | Yes | Yes |
| Task PATCH | **No** | Partial |
| Bulk reassign | **No** | Yes |
| Bulk stage change | **No** | Yes |
| Bulk delete | **No** | Yes |
| Tag add/remove | **No** | **No** |
| Custom field change | **No** | **No** |
| Deal stage drag | Separate table | Yes |
| Record create | **No** | **No** |
| Record delete | **No** | Yes |
| Merge | **No** | **No** |
| Import | **No** | Yes |

### What's Missing
- No tracking for: creates, tag changes, custom field changes, merges, task edits
- Bulk operations not tracked per-record
- No source tracking (UI vs API vs import)
- No IP address / user agent capture
- No rollback / undo capability
- No soft deletes / trash / recycle bin
- No data retention policies
- Audit log visibility is admin/manager only — not configurable per role

---

## API Endpoints (60+ routes)

### Core CRUD
- Contacts: GET/POST + GET/PATCH/DELETE [id] + duplicates + merge
- Companies: GET/POST + GET/PATCH/DELETE [id] + duplicates + merge
- Deals: GET/POST + GET/PATCH/DELETE [id] + history + checklist
- Tasks: GET/POST + GET/PATCH/DELETE [id]
- Activities: GET/POST + GET/PATCH/DELETE [id]
- Pipeline: GET/POST + stages CRUD + reorder + checklists

### Supporting
- Tags, Custom Fields, Saved Views, Email Templates, Alerts
- Search, Bulk Operations, Audit Log, Change History
- Dashboard, Analytics, Portfolio

### Admin
- Permissions, Roles, Navigation, Fields, Views, Reports

---

## Frontend Pages (26 routes)

### List Pages (with column customization, saved views)
- /contacts, /companies, /deals, /tasks

### Detail Pages (with activity timeline, change history tabs)
- /contacts/[id], /companies/[id], /deals/[id]

### Specialized
- /pipeline (Kanban board)
- /dashboard (configurable widgets)
- /alerts, /reports, /analytics, /portfolio
- /admin/* (permissions, roles, navigation, fields, views, reports)

---

## Database Schema (30+ tables)

### Core Entities
`users`, `teams`, `teamMembers`, `contacts`, `companies`, `deals`, `tasks`, `activities`

### Junction/Association
`contactTags`, `companyTags`, `dealTags`, `contactCompanies`, `dealStageHistory`, `dealChecklistItems`

### Custom Fields (EAV)
`customFieldDefinitions`, `customFieldValues`

### Pipeline
`pipelines`, `pipelineStages`, `stageChecklists`

### Admin
`adminPermissions`, `adminRoleConfig`, `adminNavItems`, `adminNavRoleAccess`, `adminReports`, `adminReportRoleAccess`, `adminCalculatedFields`

### Other
`tags`, `savedViews`, `savedViewRoleAccess`, `emailTemplates`, `alerts`, `changeHistory`, `gmvSnapshots`, `whopSyncLog`

---

## Key Enums
- `userRole`: admin, manager, account_manager, ae, enterprise_sales
- `contactType`: creator, lead, enterprise_prospect, partner
- `contactStatus`: active, churned, at_risk, prospect, closed_lost
- `recordScope`: all, own, team
- `fieldAccess`: hidden, readonly, editable
- `activityType`: 12 types (note, call, email_sent, meeting, etc.)
- `alertType`: 8 types (gmv_drop, churn_risk_increase, deal_stale, etc.)
- `verticalType`: 9 types (sports_picks, crypto_trading, software_saas, etc.)
