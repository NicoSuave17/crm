# Whop CRM — Architecture Reference

## Architecture Pattern

Next.js 16 App Router with a strict three-layer server architecture and a separate client layer connected via React Query.

```
Browser (React)
  └── Client Pages ("use client")
        └── React Query hooks  (src/lib/hooks/)
              └── fetch() → HTTP
                    └── API Routes  (src/app/api/)
                          └── Data Layer  (src/lib/api/)
                                └── Drizzle ORM  (src/lib/db/)
                                      └── PostgreSQL (Railway)
```

All authentication flows through Clerk. Every API route calls `requireUser()` before any business logic runs.

---

## Layers in Detail

### 1. Proxy / Middleware — `src/proxy.ts`

Exported as the Next.js middleware matcher. Runs on every non-static request.

- Uses `@clerk/nextjs/server` `clerkMiddleware` + `createRouteMatcher`
- Public routes: `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
- All other routes call `auth.protect()` — redirects unauthenticated users to sign-in

```
Request
  → proxy.ts (clerkMiddleware)
      → isPublicRoute? allow through
      → else: auth.protect() → redirect to /sign-in or pass with session
```

### 2. Auth Helpers — `src/lib/auth/helpers.ts`

Three exported functions used inside API routes and server functions:

| Function | Behavior |
|---|---|
| `getCurrentUser()` | Reads Clerk session, looks up CRM user in DB. Auto-creates CRM user on first login. Returns `null` if unauthenticated. |
| `requireUser()` | Calls `getCurrentUser()`, throws `"Unauthorized"` if null. |
| `requireRole(roles[])` | Calls `requireUser()`, throws `"Forbidden"` if role not in list. |

Auto-provisioning: On first Clerk login, if no row exists in `users` matching `clerk_id`, one is inserted automatically using Clerk profile data. Default role is `"ae"`.

### 3. API Routes — `src/app/api/`

Pure Next.js Route Handlers. Pattern is consistent across all routes:

```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();          // 1. Auth gate
    const params = parseSearchParams(request); // 2. Parse input
    const result = await dataLayerFn(params);  // 3. Call data layer
    return NextResponse.json(result);          // 4. Return JSON
  } catch (error) {
    if (error.message === "Unauthorized") return 401;
    return 500;
  }
}
```

Validation on write routes uses Zod (`schema.safeParse(body)`) before the data layer is called. Validation errors return `400` with `{ error, details }`.

Role-based filtering example (contacts): AMs and AEs automatically get their `ownerId` scoped — admins/managers see all.

### 4. Data Layer — `src/lib/api/`

Pure async functions. No HTTP, no auth — only Drizzle queries. One file per domain entity.

Each file exports:
- `list*()` — paginated or filtered SELECT with JOINs
- `get*()` — single record fetch
- `create*()` — INSERT + returning
- `update*()` / `move*()` — UPDATE with side effects (e.g., activity logging)
- `delete*()` — DELETE

Side effects happen inline in data layer functions. Example: `createDeal()` and `moveDeal()` both insert a row into `activities` after the primary operation to maintain the audit trail.

### 5. Database — `src/lib/db/`

- `index.ts`: Creates the `postgres` client from `DATABASE_URL` env var and exports `db` (a Drizzle instance with full schema).
- `schema.ts`: Single file containing all table definitions, enums, and Drizzle relations.

### 6. React Query Hooks — `src/lib/hooks/`

All client data fetching goes through these hooks. They wrap `@tanstack/react-query` `useQuery` / `useMutation`.

Pattern:
```typescript
// useQuery
export function useContacts(params) {
  return useQuery({
    queryKey: ["contacts", params],
    queryFn: () => fetch(`/api/contacts?...`).then(r => r.json()),
  });
}

// useMutation with cache invalidation
export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => fetch("/api/contacts", { method: "POST", ... }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });
}
```

React Query config (in `QueryProvider`): `staleTime: 30s`, `refetchOnWindowFocus: false`.

### 7. Client Pages — `src/app/(dashboard)/`

All dashboard pages are `"use client"` components. They:
1. Call hooks from `src/lib/hooks/`
2. Render shadcn/ui primitives from `src/components/ui/`
3. Use domain-specific components from `src/components/{domain}/`
4. Show `<Skeleton>` states while loading
5. Use `sonner` toast for mutation feedback

---

## Data Flow Diagrams

### Read Flow (e.g., Contacts List)

```
User navigates to /contacts
  → ContactsPage renders ("use client")
      → useContacts({ page, search, type, status })
          → React Query checks cache (staleTime 30s)
              → fetch GET /api/contacts?page=1&search=...
                  → proxy.ts: auth.protect() ✓
                      → GET handler in src/app/api/contacts/route.ts
                          → requireUser() → looks up users table by clerk_id
                          → role check: AMs/AEs scope ownerId automatically
                          → listContacts(params) in src/lib/api/contacts.ts
                              → Drizzle: SELECT with LEFT JOIN users, WHERE, ORDER, LIMIT/OFFSET
                              → returns { data[], pagination }
                          → NextResponse.json(result)
              → React Query stores in cache, returns to component
          → Component renders table rows
```

### Write Flow (e.g., Create Contact)

```
User submits ContactForm
  → useCreateContact().mutate(formData)
      → fetch POST /api/contacts, body: JSON
          → proxy.ts: auth.protect() ✓
              → POST handler in src/app/api/contacts/route.ts
                  → requireUser()
                  → createContactSchema.safeParse(body)
                      → if invalid: return 400 { error, details }
                  → createContact(parsed.data) in src/lib/api/contacts.ts
                      → db.insert(contacts).values(...).returning()
                  → NextResponse.json(contact, { status: 201 })
      → onSuccess: queryClient.invalidateQueries(["contacts"])
          → React Query refetches list, table updates
```

### Deal Drag-Drop Flow

```
User drags deal card to new column
  → KanbanBoard.handleDragEnd(event)
      → resolves targetStageId from DnD context
      → useMoveDeal().mutate({ dealId, stageId })
          → fetch PATCH /api/deals/{id}, body: { stageId }
              → deals/[id] route handler
                  → requireUser()
                  → moveDeal(id, stageId, user.id) in src/lib/api/deals.ts
                      → db.update(deals).set({ stageId })
                      → db.insert(activities) with type="deal_stage_change"
          → onSuccess: invalidate ["pipeline"], ["deals"]
```

### Auth Flow (First Login)

```
User hits protected route (e.g., /dashboard)
  → proxy.ts: clerkMiddleware runs
      → auth.protect() → Clerk validates session token
          → if no session: redirect to /sign-in
          → if valid session: request proceeds
              → API route calls requireUser()
                  → auth() returns { userId: clerkId }
                  → SELECT * FROM users WHERE clerk_id = clerkId
                      → if found: return user row
                      → if NOT found (first login):
                          → currentUser() fetches Clerk profile
                          → INSERT INTO users (clerk_id, email, first_name, ...)
                          → return new user row
```

---

## Key Abstractions and Patterns

### Audit Logging via Activities Table

Audit log is not a separate table. `logAuditEvent()` inserts into `activities` with `type = "system_event"` and stores change details in the `metadata` JSONB column. Queried by filtering `type = "system_event"` from the activities table.

```typescript
// src/lib/api/audit-log.ts
await logAuditEvent(user.id, {
  action: "bulk_reassign",
  entityType: "contact",
  entityId: "bulk",
  metadata: { contactIds, newOwnerId, count },
});
```

### EAV Pattern for Custom Fields

Custom fields use Entity-Attribute-Value:
- `custom_field_definitions`: defines field schema (name, type, options, entity type)
- `custom_field_values`: stores per-entity values with typed columns (`text_value`, `number_value`, `date_value`, `boolean_value`)
- Unique constraint on `(field_definition_id, entity_id)`

### Health Score Calculation — `src/lib/whop/health-score.ts`

Pure function `calculateHealthScore(factors)` returns 0–100 from weighted inputs:
- GMV trend (35%): % change 30d vs 60d
- Activity recency (25%): days since last AM touch
- Member growth (20%): % member change 30d
- Absolute GMV (20%): tiered scoring

`recalculateAllHealthScores()` is designed to run as a daily cron — it queries all active creators and updates `health_score` + `churn_risk` columns.

### Zod Validators as the Schema Contract

Validators in `src/lib/validators/` define the input shape for create/update operations. The same `z.infer<typeof schema>` types are used in:
- API route body parsing (server-side validation)
- Hook `mutationFn` type signatures
- Form prop types

This keeps the input contract consistent from form → hook → route → data layer.

### Saved Views

Users can bookmark filter combinations (search, type, status) as named views. Stored in `saved_views` table as `filters: Record<string, unknown>[]`. Loaded and applied client-side by iterating filter entries and calling local setState.

---

## Entry Points

### Page Entry Points

| URL | File |
|---|---|
| `/` | `src/app/page.tsx` — redirects to `/dashboard` |
| `/sign-in` | `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` |
| `/sign-up` | `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` |
| `/contacts` | `src/app/(dashboard)/contacts/page.tsx` |
| `/contacts/[id]` | `src/app/(dashboard)/contacts/[id]/page.tsx` |
| `/pipeline` | `src/app/(dashboard)/pipeline/page.tsx` |
| `/deals` | `src/app/(dashboard)/deals/page.tsx` |
| `/portfolio` | `src/app/(dashboard)/portfolio/page.tsx` |
| `/tasks` | `src/app/(dashboard)/tasks/page.tsx` |
| `/alerts` | `src/app/(dashboard)/alerts/page.tsx` |
| `/analytics` | `src/app/(dashboard)/analytics/page.tsx` |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` |

### API Route Entry Points

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/contacts` | List (paginated, filtered) / create contact |
| GET/PATCH/DELETE | `/api/contacts/[id]` | Get / update / delete contact |
| GET/POST | `/api/deals` | List / create deal |
| GET/PATCH/DELETE | `/api/deals/[id]` | Get / update / delete deal |
| GET/POST | `/api/pipeline` | List pipelines |
| GET | `/api/pipeline/[id]` | Get pipeline with stages + deals |
| GET/POST | `/api/tasks` | List / create task |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Get / update / delete task |
| GET/POST | `/api/activities` | List / create activity |
| GET/POST | `/api/tags` | List / create tag |
| PATCH/DELETE | `/api/tags/[id]` | Update / delete tag |
| POST/DELETE | `/api/tags/contact` | Add / remove tag from contact |
| GET/POST | `/api/custom-fields` | List / create custom field definitions |
| GET/PATCH/DELETE | `/api/custom-fields/[id]` | Get / update / delete definition |
| GET/POST | `/api/saved-views` | List / create saved views |
| PATCH/DELETE | `/api/saved-views/[id]` | Update / delete saved view |
| GET | `/api/alerts` | List alerts for current user |
| GET | `/api/portfolio` | Portfolio data for AM view |
| GET | `/api/dashboard` | Dashboard metrics |
| GET | `/api/analytics` | Analytics data |
| GET | `/api/search` | Global search (contacts + deals) |
| GET/PATCH | `/api/bulk` | CSV export (GET) / bulk operations (PATCH) |
| GET | `/api/audit-log` | Audit trail query |

---

## Global Providers (Root Layout)

`src/app/layout.tsx` wraps the entire app with:

```
<ClerkProvider>          ← Clerk session context
  <QueryProvider>        ← React Query client (staleTime: 30s)
    <TooltipProvider>    ← Radix UI tooltip
      {children}
      <Toaster />        ← Sonner toast notifications
    </TooltipProvider>
  </QueryProvider>
</ClerkProvider>
```

## Dashboard Layout Shell

`src/app/(dashboard)/layout.tsx` is a `"use client"` component providing:
- Collapsible desktop `<Sidebar>` (w-60 collapsed → w-16)
- Mobile `<Sheet>` drawer with the same sidebar
- `<TopNav>` with mobile menu toggle
- `<CommandPalette>` for global keyboard search (Cmd+K)
- `<main>` content area with scroll
