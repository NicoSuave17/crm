# Whop CRM — Integrations Reference

## Database — PostgreSQL via Railway

- **Provider:** Railway (managed PostgreSQL)
- **Driver:** `postgres` (postgres.js `^3.4.8`)
- **ORM:** Drizzle ORM `^0.45.1`
- **Connection file:** `src/lib/db/index.ts`

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

- **Schema:** `src/lib/db/schema.ts`
- **Migrations config:** `drizzle.config.ts`
  - Dialect: `postgresql`
  - Schema input: `./src/lib/db/schema.ts`
  - Migration output: `./drizzle/`
  - Credentials: reads `DATABASE_URL` from `.env.local` via `dotenv`

### Required env var

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string (e.g., `postgresql://user:pass@host:port/db`) |

---

## Auth Provider — Clerk

- **Package:** `@clerk/nextjs ^7.0.1`
- **Docs:** https://clerk.com/docs/nextjs

### Setup

- **Root layout:** `src/app/layout.tsx` — entire app wrapped in `<ClerkProvider>`
- **Middleware / proxy:** `src/proxy.ts` — `clerkMiddleware` from `@clerk/nextjs/server`
  - Protects all routes except: `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
  - Matcher covers all pages and API routes, skipping Next.js internals and static files

### Auth pages

- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — renders `<SignIn />` component
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — renders `<SignUp />` component

### Server-side usage

`src/lib/auth/helpers.ts` provides three helper functions used in API routes:

| Function | Behavior |
|---|---|
| `getCurrentUser()` | Returns CRM `users` record for the current Clerk session. Auto-creates the record on first login using Clerk profile data (email, name, avatar). Returns `null` if unauthenticated. |
| `requireUser()` | Calls `getCurrentUser()`, throws `"Unauthorized"` if null. Used in all API routes. |
| `requireRole(roles[])` | Calls `requireUser()`, throws `"Forbidden"` if the user's role is not in the allowed list. |

### Clerk → CRM user sync

On every request, `getCurrentUser()` looks up the CRM `users` table by `clerk_id`. If no record exists, it calls Clerk's `currentUser()` server API to fetch the Clerk profile and inserts a new `users` row automatically. The default role for new users is `ae`.

### Required env vars

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (client-side) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` (or preferred redirect) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` (or preferred redirect) |

Note: `NEXT_PUBLIC_*` variables must be available at **build time** on Vercel (set as build-time env vars, not just runtime).

---

## Whop API (Planned Integration)

- **Status:** Schema scaffolded; API client not yet built
- **Evidence in schema:**
  - `contacts.whop_company_id` — stores Whop's company identifier per creator
  - `contacts.whop_username` — stores Whop username
  - `contact_source` enum includes `whop_api_sync` — contacts sourced from sync
  - `gmv_snapshots` table — designed to store daily GMV data pulled from Whop API
  - `whop_sync_log` table — tracks sync job runs (type, status, records processed, errors)
  - `recalculateAllHealthScores()` in `src/lib/whop/health-score.ts` — designed to run as a daily cron job consuming this data

### Expected env vars (when implemented)

| Variable | Description |
|---|---|
| `WHOP_API_KEY` | API key for Whop.com data access |

---

## Webhook Endpoints

- **Public path:** `/api/webhooks(.*)` — excluded from Clerk auth protection in `src/proxy.ts`
- **Current state:** No webhook handlers implemented yet
- **Intended use:** Clerk webhooks (user events) and/or Whop webhooks (GMV/creator events)

---

## Deployment — Vercel

- **Platform:** Vercel (Next.js first-class hosting)
- **Build command:** `npm run build` → `next build`
- **Start command:** `npm run start` → `next start`

### Full env var checklist

| Variable | Where used | Required at |
|---|---|---|
| `DATABASE_URL` | `src/lib/db/index.ts`, `drizzle.config.ts` | Runtime + build |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `@clerk/nextjs` client | Build time |
| `CLERK_SECRET_KEY` | `@clerk/nextjs` server | Runtime |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk routing | Build time |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk routing | Build time |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Clerk routing | Build time |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Clerk routing | Build time |

---

## No Other Active Integrations

As of Phase 1 completion, the following are planned but not yet implemented:

- **Email** (Phase 4) — likely Resend or SendGrid for outbound email tracking
- **LinkedIn** (Phase 4) — LinkedIn message activity logging
- **Intercom** (Phase 4) — support/conversation sync
- **Cron jobs** — health score recalculation (`recalculateAllHealthScores`) designed for daily execution; no scheduler wired up yet (Vercel Cron or Railway cron would be the target)
