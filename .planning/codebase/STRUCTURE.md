# Whop CRM — Directory Structure Reference

## Complete Directory Tree

```
whop-crm/
├── .env.local                          # Environment variables (DATABASE_URL, CLERK_*)
├── .planning/                          # Planning and reference docs (not shipped)
│   └── codebase/
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
├── AGENT-SPECS.md                      # Agent task specifications
├── components.json                     # shadcn/ui config (paths, style, icon lib)
├── drizzle.config.ts                   # Drizzle Kit config (schema path, DB dialect)
├── next.config.ts                      # Next.js config (currently minimal)
├── package.json
├── postcss.config.mjs
├── tsconfig.json                       # Paths: @/* → ./src/*
│
├── public/                             # Static assets
│
└── src/
    ├── proxy.ts                        # Next.js middleware (Clerk auth gate)
    │
    ├── app/
    │   ├── globals.css                 # Tailwind base + CSS variables
    │   ├── layout.tsx                  # Root layout: ClerkProvider, QueryProvider
    │   ├── page.tsx                    # Root page: redirects to /dashboard
    │   ├── favicon.ico
    │   │
    │   ├── (auth)/                     # Auth route group (no dashboard shell)
    │   │   ├── sign-in/
    │   │   │   └── [[...sign-in]]/
    │   │   │       └── page.tsx        # Clerk <SignIn /> component
    │   │   └── sign-up/
    │   │       └── [[...sign-up]]/
    │   │           └── page.tsx        # Clerk <SignUp /> component
    │   │
    │   ├── (dashboard)/                # Dashboard route group (shares layout shell)
    │   │   ├── layout.tsx              # Sidebar + TopNav + CommandPalette
    │   │   ├── dashboard/page.tsx      # Home dashboard with metrics
    │   │   ├── contacts/
    │   │   │   ├── page.tsx            # Contact list with filters + table
    │   │   │   └── [id]/page.tsx       # Contact detail: profile + timeline + deals + tasks
    │   │   ├── pipeline/page.tsx       # Kanban board (drag-drop deals)
    │   │   ├── deals/page.tsx          # Flat deals list view
    │   │   ├── portfolio/page.tsx      # AM portfolio management
    │   │   ├── tasks/page.tsx          # Task list + create
    │   │   ├── alerts/page.tsx         # Alert feed
    │   │   ├── analytics/page.tsx      # Charts and metrics
    │   │   └── settings/page.tsx       # App settings
    │   │
    │   └── api/                        # Next.js API Route Handlers
    │       ├── activities/route.ts     # GET list / POST create activity
    │       ├── alerts/route.ts         # GET list alerts
    │       ├── analytics/route.ts      # GET analytics data
    │       ├── audit-log/route.ts      # GET audit log
    │       ├── bulk/route.ts           # GET export CSV / PATCH bulk ops
    │       ├── contacts/
    │       │   ├── route.ts            # GET list / POST create
    │       │   └── [id]/route.ts       # GET / PATCH / DELETE
    │       ├── custom-fields/
    │       │   ├── route.ts            # GET list / POST create definition
    │       │   └── [id]/route.ts       # PATCH / DELETE definition
    │       ├── dashboard/route.ts      # GET dashboard metrics
    │       ├── deals/
    │       │   ├── route.ts            # GET list / POST create
    │       │   └── [id]/route.ts       # GET / PATCH / DELETE
    │       ├── pipeline/
    │       │   ├── route.ts            # GET list all pipelines
    │       │   └── [id]/route.ts       # GET pipeline with stages + deals
    │       ├── portfolio/route.ts      # GET portfolio data
    │       ├── saved-views/
    │       │   ├── route.ts            # GET list / POST create
    │       │   └── [id]/route.ts       # PATCH / DELETE
    │       ├── search/route.ts         # GET global search (contacts + deals)
    │       ├── tags/
    │       │   ├── route.ts            # GET list / POST create tag
    │       │   ├── [id]/route.ts       # PATCH / DELETE tag
    │       │   └── contact/route.ts    # POST add / DELETE remove tag from contact
    │       └── tasks/
    │           ├── route.ts            # GET list / POST create
    │           └── [id]/route.ts       # GET / PATCH / DELETE
    │
    ├── components/
    │   ├── activities/
    │   │   ├── activity-form.tsx       # Form to log a new activity (note, call, email, etc.)
    │   │   ├── activity-item.tsx       # Single activity row in timeline
    │   │   └── activity-timeline.tsx   # Timeline component for a contact or deal
    │   ├── contacts/
    │   │   ├── contact-form.tsx        # Create/edit contact dialog form
    │   │   ├── custom-fields-display.tsx  # Renders EAV custom fields for a contact
    │   │   ├── health-score-badge.tsx  # Colored badge for 0–100 health score
    │   │   └── tag-selector.tsx        # Tag multi-select for a contact
    │   ├── layout/
    │   │   ├── command-palette.tsx     # Cmd+K global search/nav palette
    │   │   ├── sidebar.tsx             # Collapsible sidebar nav
    │   │   └── top-nav.tsx             # Top bar with mobile menu + user button
    │   ├── pipeline/
    │   │   ├── deal-card.tsx           # Individual deal card in kanban column
    │   │   ├── deal-form.tsx           # Create/edit deal dialog form
    │   │   ├── kanban-board.tsx        # DndContext wrapper, renders columns
    │   │   └── kanban-column.tsx       # Single pipeline stage column (droppable)
    │   ├── providers/
    │   │   └── query-provider.tsx      # React Query QueryClientProvider wrapper
    │   └── ui/                         # shadcn/ui primitives (auto-generated, do not hand-edit)
    │       ├── avatar.tsx
    │       ├── badge.tsx
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── checkbox.tsx
    │       ├── command.tsx
    │       ├── dialog.tsx
    │       ├── dropdown-menu.tsx
    │       ├── input.tsx
    │       ├── label.tsx
    │       ├── popover.tsx
    │       ├── scroll-area.tsx
    │       ├── select.tsx
    │       ├── separator.tsx
    │       ├── sheet.tsx
    │       ├── skeleton.tsx
    │       ├── sonner.tsx
    │       ├── table.tsx
    │       ├── tabs.tsx
    │       ├── textarea.tsx
    │       └── tooltip.tsx
    │
    └── lib/
        ├── utils.ts                    # cn() utility (clsx + tailwind-merge)
        ├── api/                        # Server-only data access layer
        │   ├── activities.ts           # listActivities, createActivity
        │   ├── alerts.ts               # listAlerts, markRead, dismiss
        │   ├── audit-log.ts            # logAuditEvent, listAuditLog
        │   ├── contacts.ts             # listContacts, getContact, createContact, updateContact, deleteContact
        │   ├── custom-fields.ts        # listDefinitions, createDefinition, getValues, upsertValue
        │   ├── deals.ts                # listDeals, listDealsByPipeline, getDeal, createDeal, updateDeal, moveDeal, deleteDeal
        │   ├── pipelines.ts            # listPipelines, getPipelineWithStages, seedDefaultPipelines
        │   ├── saved-views.ts          # listSavedViews, createSavedView, updateSavedView, deleteSavedView
        │   ├── tags.ts                 # listTags, createTag, addTagToContact, removeTagFromContact
        │   └── tasks.ts               # listTasks, getTask, createTask, updateTask, deleteTask
        ├── auth/
        │   └── helpers.ts              # getCurrentUser, requireUser, requireRole
        ├── db/
        │   ├── index.ts                # Drizzle client export: db
        │   └── schema.ts               # All tables, enums, and relations
        ├── hooks/                      # Client-only React Query hooks
        │   ├── use-activities.ts
        │   ├── use-audit-log.ts
        │   ├── use-contacts.ts         # useContacts, useContact, useCreateContact, useUpdateContact, useDeleteContact
        │   ├── use-custom-fields.ts
        │   ├── use-dashboard.ts
        │   ├── use-deals.ts
        │   ├── use-pipeline.ts         # usePipelines, usePipelineWithDeals, useMoveDeal
        │   ├── use-portfolio.ts
        │   ├── use-saved-views.ts
        │   ├── use-tags.ts
        │   └── use-tasks.ts
        ├── validators/                 # Zod schemas for API input validation
        │   ├── activity.ts
        │   ├── contact.ts              # createContactSchema, updateContactSchema + inferred types
        │   ├── deal.ts                 # createDealSchema, updateDealSchema, moveDealSchema
        │   └── task.ts
        ├── utils/
        │   └── format.ts               # formatCurrency, formatNumber, getInitials
        └── whop/
            └── health-score.ts         # calculateHealthScore, getChurnRisk, recalculateAllHealthScores
```

---

## Key File Locations

| What | Where |
|---|---|
| Database schema (all tables + relations) | `src/lib/db/schema.ts` |
| Database client | `src/lib/db/index.ts` |
| Auth helpers | `src/lib/auth/helpers.ts` |
| Middleware / auth proxy | `src/proxy.ts` |
| Data access layer | `src/lib/api/*.ts` |
| React Query hooks | `src/lib/hooks/use-*.ts` |
| Zod validators | `src/lib/validators/*.ts` |
| Domain components | `src/components/{domain}/` |
| shadcn/ui primitives | `src/components/ui/` |
| Root layout (providers) | `src/app/layout.tsx` |
| Dashboard shell layout | `src/app/(dashboard)/layout.tsx` |
| Page files | `src/app/(dashboard)/*/page.tsx` |
| API route handlers | `src/app/api/*/route.ts` |
| Health score logic | `src/lib/whop/health-score.ts` |
| Format utilities | `src/lib/utils/format.ts` |
| cn() utility | `src/lib/utils.ts` |
| Drizzle config | `drizzle.config.ts` |
| shadcn config | `components.json` |

---

## Naming Conventions

### Files

| Pattern | Example | Used for |
|---|---|---|
| `kebab-case.ts` | `health-score.ts` | All source files |
| `use-{entity}.ts` | `use-contacts.ts` | React Query hooks |
| `{entity}.ts` | `contacts.ts` | Data access layer files |
| `{entity}.ts` | `contact.ts` | Validator files (singular) |
| `route.ts` | `route.ts` | Next.js API route handlers |
| `page.tsx` | `page.tsx` | Next.js page components |
| `layout.tsx` | `layout.tsx` | Next.js layout components |
| `{noun}-{noun}.tsx` | `kanban-board.tsx` | Multi-word components |

### Directories

| Pattern | Example | Used for |
|---|---|---|
| `(group)` | `(dashboard)`, `(auth)` | Route groups (no URL segment) |
| `[param]` | `[id]` | Dynamic route segments |
| `[[...param]]` | `[[...sign-in]]` | Catch-all Clerk auth routes |
| `{domain}/` | `activities/`, `contacts/` | Domain-scoped grouping |

### Variables and Functions

| Pattern | Example | Used for |
|---|---|---|
| `camelCase` | `listContacts`, `requireUser` | All functions |
| `PascalCase` | `ContactForm`, `KanbanBoard` | React components |
| `use{Name}` | `useContacts`, `useMoveDeal` | All hooks |
| `{action}{Entity}Schema` | `createContactSchema` | Zod schemas |
| `{Action}{Entity}Input` | `CreateContactInput` | Inferred Zod types |
| `{Entity}ListParams` | `ContactListParams` | Query parameter interfaces |
| `{entity}Enum` | `userRoleEnum`, `contactTypeEnum` | Drizzle pgEnum declarations |
| `{entities}Relations` | `contactsRelations` | Drizzle relations declarations |

---

## What Goes Where

### Adding a New Page

1. Create `src/app/(dashboard)/{page-name}/page.tsx`
2. Add `"use client"` directive (all dashboard pages are client components)
3. Import hooks from `src/lib/hooks/`
4. Import domain components from `src/components/{domain}/`
5. Add nav entry to `src/components/layout/sidebar.tsx` navigation array

### Adding a New API Endpoint

1. Create `src/app/api/{entity}/route.ts` (collection) or `src/app/api/{entity}/[id]/route.ts` (single)
2. Import `requireUser` from `@/lib/auth/helpers`
3. Import data layer functions from `@/lib/api/{entity}`
4. Import Zod schema from `@/lib/validators/{entity}`
5. Follow the try/catch pattern: auth → parse → data layer → JSON response

### Adding a New Data Entity

1. Add table definition + enum(s) + relations to `src/lib/db/schema.ts`
2. Run `drizzle-kit generate` then `drizzle-kit migrate`
3. Create `src/lib/api/{entity}.ts` with CRUD functions
4. Create `src/lib/validators/{entity}.ts` with Zod schemas
5. Create `src/app/api/{entity}/route.ts` and `[id]/route.ts`
6. Create `src/lib/hooks/use-{entity}.ts` with React Query hooks
7. Create `src/components/{entity}/` for domain components if needed

### Adding a New Component

- **shadcn/ui primitive**: Run `npx shadcn add {component}` — this writes to `src/components/ui/`
- **Domain component**: Create `src/components/{domain}/{component-name}.tsx`
- **Layout component**: Create `src/components/layout/{component-name}.tsx`

### Adding New Validation

1. Add schema to `src/lib/validators/{entity}.ts`
2. Export inferred type: `export type {Name}Input = z.infer<typeof schema>`
3. Use in API route: `schema.safeParse(body)`, return 400 on failure
4. Use in hook `mutationFn` type parameter

---

## Database Tables Reference

| Table | Purpose |
|---|---|
| `users` | CRM users (linked to Clerk via `clerk_id`) |
| `contacts` | Creators, leads, enterprise prospects, partners |
| `companies` | Company entities, linked to contacts via join table |
| `contact_companies` | M2M join: contact ↔ company with role + isPrimary |
| `pipelines` | Named deal pipelines (seller_onboarding, enterprise, etc.) |
| `pipeline_stages` | Ordered stages within a pipeline |
| `deals` | Individual deals in a pipeline stage |
| `activities` | All interactions: notes, calls, emails, system events, audit log |
| `tasks` | Assignable tasks linked to contacts and/or deals |
| `tags` | Global tag definitions |
| `contact_tags` | M2M: contact ↔ tag |
| `deal_tags` | M2M: deal ↔ tag |
| `custom_field_definitions` | EAV field schema (per entity type) |
| `custom_field_values` | EAV values with typed columns |
| `saved_views` | User-saved filter sets per entity type |
| `alerts` | System alerts for GMs, churn risk, stale deals, etc. |
| `gmv_snapshots` | Daily GMV/MRR snapshots per contact (for trend calculation) |
| `whop_sync_log` | Log of Whop API sync runs |

---

## Environment Variables

| Variable | Required | Used in |
|---|---|---|
| `DATABASE_URL` | Yes | `src/lib/db/index.ts`, `drizzle.config.ts` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk (client + build time) |
| `CLERK_SECRET_KEY` | Yes | Clerk (server only) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Clerk redirect config |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Clerk redirect config |

Note: `NEXT_PUBLIC_*` variables must be present at **build time** for client-side Clerk to work. On Vercel, set these as build-time environment variables, not just runtime.

---

## Path Aliases

Configured in `tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

Always use `@/` imports rather than relative paths:
- `@/lib/db` → `src/lib/db/index.ts`
- `@/lib/auth/helpers` → `src/lib/auth/helpers.ts`
- `@/components/ui/button` → `src/components/ui/button.tsx`
- `@/lib/hooks/use-contacts` → `src/lib/hooks/use-contacts.ts`
