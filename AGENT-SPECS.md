# Whop CRM — Build-Out Specs & Instructions

> **Purpose**: This document is a complete specification for an agent to continue building out the Whop CRM. It covers the current state, tech stack, conventions, and every feature that needs to be built — organized by priority.

---

## 1. Project Overview

Custom CRM for Whop.com ($1.6B digital marketplace). Two core workflows:

1. **Creator/Seller Success** — Account Managers managing portfolios of top creators with GMV tracking, health scores, and churn risk
2. **Sales Pipeline** — Outbound prospecting, deal stages, seller onboarding, and enterprise partnerships

The core entity is a "creator with live marketplace data" — not a traditional company/contact.

---

## 2. Tech Stack & Conventions

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16 (App Router) | Uses `proxy.ts` instead of `middleware.ts` |
| ORM | Drizzle | All queries in `src/lib/api/*.ts` — never in route handlers directly |
| Database | PostgreSQL (Railway) | 18 tables, see schema below |
| Auth | Clerk | Auto-creates CRM user on first login (default role: "ae") |
| UI | shadcn/ui + Tailwind | All primitives in `src/components/ui/` |
| State | React Query (TanStack Query) | 30s staleTime, hooks in `src/lib/hooks/` |
| DnD | @dnd-kit/core | Used for Kanban board |
| Charts | Recharts | Used on analytics page |
| Validation | Zod | Schemas in `src/lib/validators/` |
| Icons | lucide-react | Used everywhere |
| Toasts | sonner | `toast.success()`, `toast.error()` |

### Key Patterns to Follow

**API Routes** (`src/app/api/[entity]/route.ts`):
- Import data functions from `src/lib/api/[entity].ts`
- Import auth helper from `src/lib/auth`
- Always call `await requireUser()` for auth
- Parse request body with Zod validator
- Return `NextResponse.json()`
- Role-based scoping: AMs/AEs auto-filter to `ownerId = user.id`

**Data Layer** (`src/lib/api/[entity].ts`):
- Import `db` from `@/lib/db`
- Import schema from `@/lib/db/schema`
- Use Drizzle query builder (`db.select()`, `db.insert()`, etc.)
- Export named functions (e.g., `listContacts`, `createContact`)
- All pagination uses `limit`/`offset` with a `pagination` object in the response

**Hooks** (`src/lib/hooks/use-[entity].ts`):
- Use `useQuery` for reads, `useMutation` for writes
- Invalidate relevant query keys on mutation success
- Export named hooks (e.g., `useContacts`, `useCreateContact`)

**Pages** (`src/app/(dashboard)/[entity]/page.tsx`):
- `"use client"` at top
- Use hooks for data fetching
- Show `Skeleton` components while loading
- All forms in `Dialog` components from shadcn/ui

**Components**:
- Use shadcn/ui primitives (Button, Input, Select, Dialog, Table, Card, Badge, etc.)
- All imports from `@/components/ui/[component]`

### Auth Helper

```typescript
// src/lib/auth.ts
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function requireUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthorized");

  let user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });

  if (!user) {
    // Auto-create on first login
    const [newUser] = await db.insert(users).values({
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      firstName: clerkUser.firstName ?? "",
      lastName: clerkUser.lastName ?? "",
      avatarUrl: clerkUser.imageUrl,
      role: "ae",
    }).returning();
    user = newUser;
  }

  return user;
}
```

---

## 3. Database Schema Reference

Full schema is at `src/lib/db/schema.ts` (718 lines). Key tables:

**Core**: `users`, `contacts`, `companies`, `contact_companies`
**Pipeline**: `pipelines`, `pipeline_stages`, `deals`
**Activities**: `activities`, `tasks`
**Tags**: `tags`, `contact_tags`, `deal_tags`
**Custom Fields**: `custom_field_definitions`, `custom_field_values`
**Other**: `saved_views`, `alerts`, `gmv_snapshots`, `whop_sync_log`

### Important Enums
- `user_role`: admin, manager, account_manager, ae, enterprise_sales
- `contact_type`: creator, lead, enterprise_prospect, partner
- `contact_status`: active, churned, at_risk, prospect, closed_lost
- `contact_tier`: enterprise, premium, standard, starter
- `task_status`: pending, in_progress, completed, cancelled
- `deal_priority` / `task_priority`: low, medium, high, urgent
- `activity_type`: note, call, email_sent, email_received, meeting, linkedin_message, task_completed, deal_stage_change, health_score_change, gmv_milestone, churn_alert, system_event

---

## 4. What Already Exists (Working)

### Fully Functional
- Clerk auth flow (sign-in, sign-up, auto-user-creation)
- Dashboard with 6 KPI cards + recent alerts feed
- Contacts list with search, type/status filters, pagination, saved views, CSV export
- Contact create form (firstName, lastName, email, phone, type, source, linkedinUrl)
- Contact detail page (profile card, health metrics, tags, custom fields, activity timeline)
- Contact delete
- Pipeline Kanban board with drag-and-drop stage moves
- Deal create form (title, contactId, stageId, priority, value, expectedCloseDate, description)
- Deal detail page
- Deals list page (table view)
- Tasks list with create dialog (title, priority, dueDate), status toggle, filters
- Activity timeline on contact detail (create notes, calls, emails, meetings)
- Portfolio page (creator card grid with health/GMV/churn risk)
- Alerts center (view, mark read, filter by severity)
- Analytics page (6 Recharts visualizations)
- Settings page (tags CRUD, custom field definitions CRUD, pipeline viewer)
- Tag selector on contact detail
- Custom fields display/edit on contact detail
- Saved views for contacts
- Bulk CSV export for contacts
- Audit log API
- Command palette (Cmd+K) with search
- Role-based data scoping (AMs/AEs see own data)
- Responsive sidebar + mobile sheet nav

### Partially Functional
- Contact edit — PATCH API exists, **no edit UI**
- Deal edit — PATCH API exists, **no edit UI** (only stage drag works)
- Task edit — PATCH API exists, **no edit UI** (only status toggle works)
- Activity edit/delete — **no API or UI**
- Contact detail deals tab — **shows empty placeholder**
- Contact detail tasks tab — **shows empty placeholder**
- Pipeline management — **read-only in settings, no create/edit/delete**
- Custom field "select" type — definition supported, **no options configuration UI**

---

## 5. Features to Build (Priority Order)

### P0 — Critical (CRM is barely usable without these)

#### 5.1 Edit Contact Modal
**What**: Full edit dialog accessible from contact detail page and contacts list dropdown.
**Files to modify**:
- `src/components/contacts/contact-form.tsx` — Extend to support edit mode (pre-fill fields, PATCH on submit)
- `src/app/(dashboard)/contacts/[id]/page.tsx` — Add "Edit" button that opens form in edit mode
- `src/app/(dashboard)/contacts/page.tsx` — Add "Edit" option to dropdown menu

**Fields to expose** (all from `updateContactSchema`):
- firstName, lastName, email, phone (already in create)
- **Add**: status (select), tier (select), twitterUrl, websiteUrl, ownerId (user picker), healthScore (number 0-100), whopUsername (text)
- The form should accept an optional `contact` prop. When present, pre-fill all fields and use PATCH instead of POST.

**Hook needed**: `useUpdateContact` in `src/lib/hooks/use-contacts.ts`
```typescript
export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact", id] });
    },
  });
}
```

#### 5.2 Edit Deal Modal
**What**: Edit dialog for deals from deal detail and deals list.
**Files to modify**:
- `src/components/pipeline/deal-form.tsx` — Extend for edit mode
- `src/app/(dashboard)/deals/page.tsx` — Add edit action to row dropdown

**Additional fields to expose**:
- companyId (company picker — see 5.7)
- expectedMrr (number)
- lostReason (text, shown when stage isLost)
- description (textarea)

**Hook needed**: `useUpdateDeal` in `src/lib/hooks/use-deals.ts`

#### 5.3 Edit Task Modal
**What**: Proper edit dialog for tasks with all fields.
**Files to modify**:
- Create `src/components/tasks/task-form.tsx` — Reusable form component
- `src/app/(dashboard)/tasks/page.tsx` — Replace inline create dialog with TaskForm, add edit action

**Fields to expose**:
- title, description (textarea), status (select), priority (select), dueDate (date)
- **assigneeId** — User/team member picker (critical, see 5.5)
- **contactId** — Contact picker (searchable select)
- **dealId** — Deal picker (searchable select)

#### 5.4 Contact Detail — Deals & Tasks Tabs
**What**: Replace empty placeholders with actual data.
**Files to modify**:
- `src/app/(dashboard)/contacts/[id]/page.tsx`

**Deals tab**:
- Fetch deals where `contactId = id` (add to `useContact` hook or create `useContactDeals`)
- Show as a mini table: title, stage, value, priority, expected close date
- Each row links to deal detail
- "Add Deal" button that opens DealForm pre-filled with contactId

**Tasks tab**:
- Fetch tasks where `contactId = id` (create `useContactTasks`)
- Show as a list: title, status, priority, due date, assignee
- Status toggle checkbox (same as tasks page)
- "Add Task" button that opens TaskForm pre-filled with contactId

#### 5.5 User / Team Management
**What**: Admin UI to view team members, change roles, invite users.
**Where**: New tab in Settings page OR new `/settings/team` page.

**API routes to create** (`src/app/api/users/route.ts`):
- `GET /api/users` — List all CRM users (admin/manager only). Data function already partially exists as the `users` table is queryable.
- `PATCH /api/users/[id]` — Update role, isActive (admin only)
- No invite flow needed yet — users auto-create on Clerk sign-in. But display a note: "Share your Clerk sign-in URL to invite team members."

**Data layer** (`src/lib/api/users.ts`):
```typescript
export async function listUsers() {
  return db.select().from(users).orderBy(users.firstName);
}

export async function updateUser(id: string, data: { role?: string; isActive?: boolean }) {
  const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return updated;
}
```

**UI**:
- Table showing: avatar, name, email, role (editable select), status (active/inactive toggle)
- Only admin users can change roles
- Show current user's own role as non-editable
- Add `useUsers`, `useUpdateUser` hooks

**User Picker Component** (`src/components/shared/user-picker.tsx`):
- Searchable select dropdown showing all active users
- Used in: contact form (ownerId), task form (assigneeId), deal form (ownerId)
- Shows avatar + name in each option

#### 5.6 Pipeline & Stage Management
**What**: Full CRUD for pipelines and their stages in Settings.
**Files to modify**:
- `src/app/(dashboard)/settings/page.tsx` — Replace read-only pipeline tab

**API routes to create**:
- `POST /api/pipeline` — Create pipeline
- `PATCH /api/pipeline/[id]` — Update pipeline (name, description, type)
- `DELETE /api/pipeline/[id]` — Delete pipeline (only if no deals)
- `POST /api/pipeline/[id]/stages` — Create stage
- `PATCH /api/pipeline/[id]/stages/[stageId]` — Update stage
- `DELETE /api/pipeline/[id]/stages/[stageId]` — Delete stage (only if no deals in stage)

**Data layer** (`src/lib/api/pipelines.ts` — extend existing):
- `createPipeline`, `updatePipeline`, `deletePipeline`
- `createStage`, `updateStage`, `deleteStage`, `reorderStages`

**Stage fields**: name, color (hex picker), probability (0-100), isWon (boolean), isLost (boolean), position (drag to reorder)

**UI**:
- List of pipelines with expand/collapse for stages
- Add Pipeline button → dialog with name, description, type
- Each pipeline: edit name button, delete button (with confirmation)
- Stages list with drag-to-reorder (use @dnd-kit)
- Add Stage button per pipeline
- Each stage: inline edit (name, color, probability, isWon/isLost), delete

#### 5.7 Company CRUD
**What**: Full company management. Schema exists, zero implementation.

**Data layer** — Create `src/lib/api/companies.ts`:
- `listCompanies(params)` — Paginated list with search, filter by industry/size/owner
- `getCompany(id)` — Single company with related contacts and deals
- `createCompany(data)` — Insert new company
- `updateCompany(id, data)` — Update company
- `deleteCompany(id)` — Soft or hard delete

**Validator** — Create `src/lib/validators/company.ts`:
```typescript
export const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).optional(),
  description: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  ownerId: z.string().uuid().optional(),
});
```

**API routes** — Create `src/app/api/companies/route.ts` and `src/app/api/companies/[id]/route.ts`:
- GET (list, single), POST, PATCH, DELETE

**Hooks** — Create `src/lib/hooks/use-companies.ts`:
- `useCompanies`, `useCompany`, `useCreateCompany`, `useUpdateCompany`, `useDeleteCompany`

**Pages**:
- Create `src/app/(dashboard)/companies/page.tsx` — Companies list with table, search, filters, create dialog
- Create `src/app/(dashboard)/companies/[id]/page.tsx` — Company detail with: profile card (name, domain, industry, size, description, links), related contacts list, related deals list, activity timeline, custom fields

**Components**:
- Create `src/components/companies/company-form.tsx` — Create/edit dialog
- Create `src/components/shared/company-picker.tsx` — Searchable select for forms

**Sidebar**: Add "Companies" link to sidebar nav (`src/components/layout/sidebar.tsx`) between Contacts and Pipeline.

#### 5.8 Contact-Company Linking
**What**: Junction table `contact_companies` exists but is unused.
**Where**: Contact detail page + Company detail page

- On contact detail: "Companies" section showing linked companies with role
- "Link Company" button → picker dialog with company search + role field
- On company detail: "Contacts" section showing linked contacts
- API: `POST /api/contacts/[id]/companies` (link), `DELETE /api/contacts/[id]/companies/[companyId]` (unlink)

---

### P1 — Important (Makes the CRM actually useful day-to-day)

#### 5.9 Deal Detail Page Enhancement
**Current**: Basic deal detail exists.
**Needs**:
- Activity timeline on deal (already supported in schema — `activities.dealId`)
- Stage history (show progression through pipeline stages with timestamps)
- Edit button → deal form
- "Log Activity" button → activity form pre-filled with dealId
- Associated contact and company cards (clickable links)
- Custom fields display (same as contacts)
- Tags (deal_tags junction table exists)

#### 5.10 Searchable Entity Pickers
**What**: Reusable searchable select components used across forms.
**Create `src/components/shared/entity-picker.tsx`** — or individual pickers:
- `contact-picker.tsx` — Search contacts by name/email, show avatar + name + type badge
- `company-picker.tsx` — Search companies by name/domain
- `user-picker.tsx` — Select from active team members (see 5.5)
- `deal-picker.tsx` — Search deals by title

These should use the `Popover` + `Command` components from shadcn/ui (combobox pattern).

#### 5.11 Bulk Operations UI
**What**: Currently bulk export works via API, but there's no UI for bulk operations.
**Where**: Contacts list page, deals list page

- Row selection checkboxes
- Bulk action bar (appears when rows selected): "Reassign to..." (user picker), "Change status to..." (select), "Add tag..." (tag picker), "Delete selected" (with confirmation)
- For deals: "Move to stage..." (stage picker)
- CSV import dialog with file upload, column mapping preview, confirm

#### 5.12 Activity Delete/Edit
**What**: Activities can be created but never edited or deleted.
**API**: Add `PATCH /api/activities/[id]` and `DELETE /api/activities/[id]`
**UI**: Add edit/delete buttons to activity items in the timeline (only for activities created by the current user)

#### 5.13 Saved Views — Complete Implementation
**Current**: Works for contacts only.
**Extend to**: Deals, tasks, companies
- Each list page gets the same save/load view bar as contacts
- Saved views store: entity type, filters, sort, column visibility

#### 5.14 Custom Fields — Select Options UI
**What**: Custom field type "select" exists but there's no way to define the options.
**Where**: Settings > Custom Fields tab
**UI**: When creating/editing a field with type "select" or "multi_select", show an options editor:
- List of option values with add/remove
- Options stored as JSON array in `custom_field_definitions.options`
**Display**: In `custom-fields-display.tsx`, render select fields as a dropdown with the defined options

---

### P2 — Nice to Have (Polishes the experience)

#### 5.15 Audit Log UI
**What**: API exists (`/api/audit-log`), no page.
**Create**: `src/app/(dashboard)/settings/audit-log/page.tsx` or add as Settings tab
- Table: timestamp, user, action, entity type, entity name, details
- Filters: date range, user, entity type

#### 5.16 Notification System
**What**: Alerts exist but there's no real-time notification.
- Add a bell icon to top nav showing unread alert count
- Clicking opens a dropdown with recent alerts
- Link to full alerts page

#### 5.17 Dashboard Customization
- Allow users to rearrange/hide KPI cards
- Date range selector for dashboard metrics
- Pipeline selector (currently aggregates all pipelines)

#### 5.18 Contact/Deal Import Wizard
- Step 1: Upload CSV
- Step 2: Map columns to fields (auto-detect common headers)
- Step 3: Preview first 5 rows
- Step 4: Import with progress bar
- Step 5: Summary (created, skipped, errors)

#### 5.19 Email Templates
- Template CRUD in settings
- Variable interpolation: `{{firstName}}`, `{{companyName}}`, etc.
- Use when logging email activities

#### 5.20 Advanced Search / Cmd+K Enhancement
- Current command palette searches contacts only
- Extend to: deals, companies, tasks, settings pages
- Show recent items
- Quick actions: "Create contact", "Create deal", etc.

---

## 6. Known Bugs & Issues to Fix

1. **Contact form missing fields**: `status`, `tier`, `twitterUrl`, `websiteUrl`, `ownerId` exist in validator but not in UI
2. **Task form missing fields**: `description`, `contactId`, `dealId`, `assigneeId` exist in validator but not in UI
3. **Deal form missing fields**: `companyId`, `expectedMrr` exist in validator but not in UI
4. **Custom field multi_select**: Enum value exists, excluded from settings UI
5. **Saved view delete**: Hook exists (`useDeleteSavedView`) but no delete button in the saved views bar
6. **Contact detail deals tab**: Shows "No deals yet" static text — should query actual deals
7. **Contact detail tasks tab**: Shows "No tasks yet" static text — should query actual tasks
8. **Pipeline settings**: Read-only — no way to create/edit/delete pipelines or stages from UI
9. **No GET for single task**: `src/app/api/tasks/[id]/route.ts` has PATCH and DELETE but no GET

---

## 7. File Structure Reference

```
src/
├── app/
│   ├── (auth)/sign-in, sign-up
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── contacts/page.tsx, [id]/page.tsx
│   │   ├── companies/page.tsx, [id]/page.tsx     ← CREATE
│   │   ├── deals/page.tsx
│   │   ├── pipeline/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── contacts/, contacts/[id]/
│       ├── companies/, companies/[id]/            ← CREATE
│       ├── deals/, deals/[id]/
│       ├── tasks/, tasks/[id]/
│       ├── pipeline/, pipeline/[id]/
│       ├── activities/
│       ├── users/, users/[id]/                    ← CREATE
│       ├── tags/, tags/[id]/, tags/contact/
│       ├── custom-fields/, custom-fields/[id]/
│       ├── saved-views/, saved-views/[id]/
│       ├── alerts/
│       ├── audit-log/
│       ├── bulk/
│       ├── dashboard/
│       ├── portfolio/
│       ├── search/
│       └── analytics/
├── components/
│   ├── ui/                    (shadcn primitives)
│   ├── layout/                (sidebar, top-nav, command-palette)
│   ├── contacts/              (contact-form, health-score-badge, tag-selector, custom-fields-display)
│   ├── companies/             ← CREATE (company-form)
│   ├── pipeline/              (deal-form, deal-card, kanban-board, kanban-column)
│   ├── activities/            (activity-form, activity-item, activity-timeline)
│   ├── tasks/                 ← CREATE (task-form)
│   ├── shared/                ← CREATE (user-picker, contact-picker, company-picker, deal-picker)
│   └── providers/
├── lib/
│   ├── db/schema.ts, index.ts
│   ├── api/                   (contacts, deals, tasks, activities, pipelines, tags, custom-fields, saved-views, alerts, audit-log)
│   │   └── companies.ts       ← CREATE
│   │   └── users.ts           ← CREATE
│   ├── hooks/                 (use-contacts, use-deals, use-tasks, use-pipeline, use-activities, use-tags, use-custom-fields, use-saved-views, use-alerts, use-audit-log, use-dashboard, use-portfolio)
│   │   └── use-companies.ts   ← CREATE
│   │   └── use-users.ts       ← CREATE
│   ├── auth.ts
│   ├── utils/format.ts
│   └── validators/            (contact, deal, task, activity)
│       └── company.ts         ← CREATE
└── types/
```

---

## 8. Build & Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev          # Starts on localhost:3000 (or 3001 if 3000 is taken)

# Build (MUST pass before any deploy)
npm run build

# Database migrations
npx drizzle-kit push  # Push schema changes to Railway DB

# Environment
# .env.local contains all secrets (DATABASE_URL, Clerk keys)
# drizzle.config.ts uses explicit dotenv loading for .env.local
```

---

## 9. Implementation Order

Recommended build sequence to minimize blockers:

1. **User management** (5.5) — Needed as a dependency for user pickers everywhere
2. **Entity pickers** (5.10) — Needed by all edit forms
3. **Edit contact** (5.1) — Most-used entity
4. **Edit deal** (5.2) + Deal detail enhancement (5.9)
5. **Task form** (5.3) — With assignee/contact/deal linking
6. **Contact detail tabs** (5.4) — Deals + tasks tabs
7. **Company CRUD** (5.7) + Contact-company linking (5.8)
8. **Pipeline management** (5.6)
9. **Bulk operations UI** (5.11)
10. **Activity edit/delete** (5.12)
11. **Remaining P1 items** (5.13, 5.14)
12. **P2 items** as time allows

---

## 10. Quality Checklist

After each feature:
- [ ] `npm run build` passes with zero errors
- [ ] Feature works end-to-end (create → view → edit → delete)
- [ ] Loading states show skeletons
- [ ] Empty states show helpful messages
- [ ] Toast notifications on success/error
- [ ] Responsive (works on mobile sidebar-collapsed view)
- [ ] Role-based access respected (AMs/AEs scoped to own data where applicable)
- [ ] No TypeScript errors
- [ ] No browser console errors
