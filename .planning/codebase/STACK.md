# Whop CRM — Tech Stack Reference

## Languages & Runtime

- **Language:** TypeScript 5 (`^5`) — strict mode enabled
- **Runtime:** Node.js (`@types/node ^20`)
- **TypeScript config:** `tsconfig.json`
  - Target: `ES2017`
  - Module resolution: `bundler` (Next.js native)
  - Strict mode: `true`
  - `isolatedModules: true`, `noEmit: true`
  - Path alias: `@/*` maps to `./src/*`
  - Next.js plugin included for enhanced type checking

---

## Framework

- **Next.js 16.1.6** (`next: 16.1.6`) — App Router
- **React 19.2.3** (`react`, `react-dom`)
- **App Router structure:**
  - `src/app/(auth)/` — Clerk sign-in / sign-up pages (catch-all routes)
  - `src/app/(dashboard)/` — Protected dashboard pages (contacts, deals, pipeline, tasks, portfolio, alerts, analytics, settings)
  - `src/app/api/` — Route handlers (REST endpoints, no tRPC)
  - `src/app/layout.tsx` — Root layout with `ClerkProvider`, `QueryProvider`, `TooltipProvider`, `Toaster`
- **Fonts:** Geist Sans + Geist Mono via `next/font/google`
- **Auth proxy:** `src/proxy.ts` — uses `clerkMiddleware` (note: named `proxy.ts` not `middleware.ts` per Next.js 16 convention)
- **Config:** `next.config.ts` (currently empty — no custom config needed)

---

## Database

- **Database:** PostgreSQL (hosted on Railway)
- **ORM:** Drizzle ORM `^0.45.1` (`drizzle-orm`)
- **Driver:** `postgres` `^3.4.8` (postgres.js — the native Postgres driver)
- **Connection:** `src/lib/db/index.ts`
  - Creates a `postgres()` client from `DATABASE_URL`
  - Exports `db = drizzle(client, { schema })` — schema-aware instance
- **Schema file:** `src/lib/db/schema.ts` — all tables, enums, and relations defined here
- **Migrations:** Drizzle Kit `^0.31.9` (`drizzle-kit`)
  - Config: `drizzle.config.ts`
  - Output directory: `./drizzle/`
  - Dialect: `postgresql`
  - Credentials loaded from `.env.local` via `dotenv`

### Database Tables

| Table | Purpose |
|---|---|
| `users` | CRM team members (linked to Clerk via `clerk_id`) |
| `contacts` | Creators, leads, enterprise prospects, partners |
| `companies` | Company records (linked to contacts M:M) |
| `contact_companies` | Join table: contacts ↔ companies |
| `pipelines` | Named sales pipelines (seller_onboarding, enterprise, partnerships, custom) |
| `pipeline_stages` | Kanban stages within a pipeline |
| `deals` | Individual deals linked to pipeline + stage + contact |
| `activities` | Timeline log: notes, calls, emails, meetings, LinkedIn, system events |
| `tasks` | Assignable to-dos linked to contacts or deals |
| `tags` | Color-coded labels |
| `contact_tags` | Join table: contacts ↔ tags |
| `deal_tags` | Join table: deals ↔ tags |
| `custom_field_definitions` | EAV schema: field definitions per entity type |
| `custom_field_values` | EAV values: typed columns (text, number, date, boolean) |
| `saved_views` | Persisted filter/sort/column configs per user |
| `alerts` | System-generated notifications (GMV drop, churn risk, etc.) |
| `gmv_snapshots` | Daily GMV + member count history per contact |
| `whop_sync_log` | Audit log for Whop API sync operations |

### PostgreSQL Enums

`user_role`, `contact_type`, `contact_status`, `contact_tier`, `churn_risk`, `contact_source`, `company_size`, `pipeline_type`, `deal_priority`, `activity_type`, `task_status`, `task_priority`, `entity_type`, `field_type`, `view_entity_type`, `alert_type`, `alert_severity`, `sync_status`

---

## Authentication

- **Provider:** Clerk (`@clerk/nextjs ^7.0.1`)
- **Middleware:** `src/proxy.ts` — `clerkMiddleware` protects all routes except `/sign-in`, `/sign-up`, and `/api/webhooks`
- **Public routes:** `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
- **Auth pages:** `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — use Clerk's hosted `<SignIn />` / `<SignUp />` components
- **Root layout:** Wrapped in `<ClerkProvider>` at `src/app/layout.tsx`
- **CRM user sync:** `src/lib/auth/helpers.ts`
  - `getCurrentUser()` — looks up CRM user by `clerkId`; auto-creates `users` record on first login using Clerk profile data
  - `requireUser()` — throws `"Unauthorized"` if not authenticated
  - `requireRole(roles[])` — throws `"Forbidden"` if user role not in allowed list
- **Roles:** `admin`, `manager`, `account_manager`, `ae`, `enterprise_sales`

---

## UI Libraries

### shadcn/ui
- **Config:** `components.json` — style: `new-york`, base color: `neutral`, CSS variables enabled, Lucide icons
- **Components installed:** `src/components/ui/`
  - `button`, `input`, `label`, `textarea`, `select`, `checkbox`
  - `dialog`, `dropdown-menu`, `sheet`, `popover`, `tabs`
  - `card`, `badge`, `avatar`, `separator`, `skeleton`
  - `table`, `scroll-area`, `tooltip`
  - `sonner` (toast notifications via Sonner)
  - `command` (used for command palette, powered by `cmdk`)

### Tailwind CSS 4
- **Version:** `tailwindcss ^4` (v4 — major rewrite, CSS-first config)
- **PostCSS plugin:** `@tailwindcss/postcss ^4` (`postcss.config.mjs`)
- **CSS entry:** `src/app/globals.css` — uses `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`
- **Animations:** `tw-animate-css ^1.4.0`
- **Dark mode:** Custom variant `dark (&:is(.dark *))` via `next-themes`
- **Utility helpers:** `clsx ^2.1.1` + `tailwind-merge ^3.5.0`, combined in `src/lib/utils.ts` as `cn()`

### Recharts
- **Version:** `recharts ^3.7.0`
- **Usage:** Analytics and portfolio charts (GMV trends, health scores)

### @dnd-kit
- **`@dnd-kit/core ^6.3.1`** — drag-and-drop primitives
- **`@dnd-kit/sortable ^10.0.0`** — sortable list/board
- **`@dnd-kit/utilities ^3.2.2`** — transform helpers
- **Usage:** Kanban board in `src/components/pipeline/kanban-board.tsx`

### Lucide React
- **Version:** `lucide-react ^0.577.0`
- **Usage:** All icons throughout the app (default icon library for shadcn/ui)

### Other UI
- **`next-themes ^0.4.6`** — Dark/light mode toggling
- **`sonner ^2.0.7`** — Toast notification library (used via `<Toaster />` in root layout)
- **`date-fns ^4.1.0`** — Date formatting (`formatDistanceToNow`, etc.)
- **`cmdk ^1.1.1`** — Command menu primitive (powers `src/components/layout/command-palette.tsx`)

---

## State Management

- **TanStack Query (React Query) v5** (`@tanstack/react-query ^5.90.21`)
- **Provider:** `src/components/providers/query-provider.tsx` — wraps app in `QueryClientProvider`
- **Default config:** `staleTime: 30s`, `refetchOnWindowFocus: false`
- **Pattern:** Custom hooks in `src/lib/hooks/` fetch from Next.js API routes via `fetch()`
  - `use-contacts.ts` — `useContacts`, `useContact`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`
  - `use-deals.ts`, `use-pipeline.ts`, `use-tasks.ts`, `use-activities.ts`
  - `use-dashboard.ts`, `use-portfolio.ts`, `use-alerts.ts`, `use-tags.ts`
  - `use-custom-fields.ts`, `use-saved-views.ts`, `use-audit-log.ts`
- **URL state:** `nuqs ^2.8.9` — syncs filter/sort params to URL query string

---

## Validation

- **Zod v4** (`zod ^4.3.6`)
- **Validators:** `src/lib/validators/`
  - `contact.ts` — `createContactSchema`, `updateContactSchema` (partial)
  - `deal.ts` — deal creation/update schemas
  - `task.ts` — task creation/update schemas
  - `activity.ts` — activity creation schema
- **Usage pattern:** All POST/PATCH API routes use `schema.safeParse(body)` before touching the database

---

## Data Access Layer

- **Location:** `src/lib/api/`
- **Pattern:** Plain async functions that accept typed inputs, run Drizzle queries, and return results
  - `contacts.ts` — `listContacts`, `getContact`, `createContact`, `updateContact`, `deleteContact`
  - `deals.ts` — `listDealsByPipeline`, `getDeal`, `createDeal`, `updateDeal`, `deleteDeal`
  - `tasks.ts` — task CRUD
  - `activities.ts` — activity log CRUD
  - `pipelines.ts` — pipeline + stage management
  - `tags.ts` — tag CRUD, contact tag assignment
  - `custom-fields.ts` — EAV field definitions and values
  - `saved-views.ts` — user saved view CRUD
  - `alerts.ts` — alert CRUD and mark-as-read
  - `audit-log.ts` — audit log queries
- **Auth integration:** All API routes call `requireUser()` or `requireRole()` before invoking data access functions

---

## Business Logic

- **Health scores:** `src/lib/whop/health-score.ts`
  - `calculateHealthScore(factors)` — weighted formula (GMV trend 35%, activity recency 25%, member growth 20%, absolute GMV 20%)
  - `getChurnRisk(healthScore)` — maps 0-100 score to `low`/`medium`/`high`/`critical`
  - `recalculateAllHealthScores()` — batch job to update all active creators (designed for daily cron)

---

## API Routes

All under `src/app/api/`:

| Route | Methods | Purpose |
|---|---|---|
| `/api/contacts` | GET, POST | List/create contacts |
| `/api/contacts/[id]` | GET, PATCH, DELETE | Contact detail/update/delete |
| `/api/deals` | GET, POST | List/create deals |
| `/api/deals/[id]` | GET, PATCH, DELETE | Deal detail/update/delete |
| `/api/pipeline` | GET, POST | List/create pipelines |
| `/api/pipeline/[id]` | GET, PATCH, DELETE | Pipeline detail |
| `/api/tasks` | GET, POST | List/create tasks |
| `/api/tasks/[id]` | GET, PATCH, DELETE | Task detail |
| `/api/activities` | GET, POST | List/create activities |
| `/api/tags` | GET, POST | List/create tags |
| `/api/tags/[id]` | PATCH, DELETE | Tag update/delete |
| `/api/tags/contact` | POST, DELETE | Assign/remove tag from contact |
| `/api/custom-fields` | GET, POST | Custom field definitions |
| `/api/custom-fields/[id]` | PATCH, DELETE | Custom field definition update |
| `/api/saved-views` | GET, POST | Saved view CRUD |
| `/api/saved-views/[id]` | PATCH, DELETE | Saved view update |
| `/api/search` | GET | Global search across contacts/deals |
| `/api/dashboard` | GET | KPI summary for dashboard |
| `/api/analytics` | GET | Analytics data |
| `/api/portfolio` | GET | AM portfolio view data |
| `/api/alerts` | GET, POST | Alerts list/create |
| `/api/audit-log` | GET | Audit log entries |
| `/api/bulk` | POST | Bulk operations |

---

## Build & Dev Tools

| Tool | Version | Purpose |
|---|---|---|
| `eslint` | `^9` | Linting |
| `eslint-config-next` | `16.1.6` | Next.js ESLint rules |
| `eslint.config.mjs` | — | ESLint flat config |
| `drizzle-kit` | `^0.31.9` | DB schema migrations + studio |
| `shadcn` | `^3.8.5` | shadcn/ui CLI for adding components |
| `dotenv` | `^17.3.1` | Load `.env.local` for `drizzle.config.ts` |
| `typescript` | `^5` | Type checking |

### NPM Scripts

```
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint
```

---

## All Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `@clerk/nextjs` | `^7.0.1` | Authentication provider |
| `@dnd-kit/core` | `^6.3.1` | Drag-and-drop core |
| `@dnd-kit/sortable` | `^10.0.0` | Sortable DnD for Kanban |
| `@dnd-kit/utilities` | `^3.2.2` | DnD transform utilities |
| `@tanstack/react-query` | `^5.90.21` | Server state / data fetching |
| `class-variance-authority` | `^0.7.1` | shadcn/ui variant system |
| `clsx` | `^2.1.1` | Conditional class names |
| `cmdk` | `^1.1.1` | Command palette primitive |
| `date-fns` | `^4.1.0` | Date formatting utilities |
| `drizzle-orm` | `^0.45.1` | Type-safe ORM for PostgreSQL |
| `lucide-react` | `^0.577.0` | Icon library |
| `next` | `16.1.6` | Full-stack React framework |
| `next-themes` | `^0.4.6` | Dark/light mode |
| `nuqs` | `^2.8.9` | URL query string state |
| `postgres` | `^3.4.8` | PostgreSQL driver (postgres.js) |
| `radix-ui` | `^1.4.3` | Headless UI primitives (shadcn dependency) |
| `react` | `19.2.3` | UI library |
| `react-dom` | `19.2.3` | React DOM renderer |
| `recharts` | `^3.7.0` | Charting library |
| `sonner` | `^2.0.7` | Toast notifications |
| `tailwind-merge` | `^3.5.0` | Tailwind class deduplication |
| `zod` | `^4.3.6` | Schema validation |

### Dev

| Package | Version | Purpose |
|---|---|---|
| `@tailwindcss/postcss` | `^4` | Tailwind PostCSS plugin |
| `@types/node` | `^20` | Node.js type definitions |
| `@types/react` | `^19` | React type definitions |
| `@types/react-dom` | `^19` | React DOM type definitions |
| `dotenv` | `^17.3.1` | Load `.env.local` for drizzle-kit |
| `drizzle-kit` | `^0.31.9` | DB migrations + Drizzle Studio |
| `eslint` | `^9` | Linter |
| `eslint-config-next` | `16.1.6` | Next.js lint rules |
| `shadcn` | `^3.8.5` | shadcn/ui component CLI |
| `tailwindcss` | `^4` | CSS framework |
| `tw-animate-css` | `^1.4.0` | Tailwind animation utilities |
| `typescript` | `^5` | TypeScript compiler |
