# Codebase Conventions

Reference document describing the actual patterns used in this codebase. Use these as the template when adding new features.

---

## Code Style

### TypeScript Patterns

- Strict TypeScript throughout — no `any`, use `unknown` for truly unknown shapes
- Infer types from Zod schemas and Drizzle tables rather than writing them by hand:

```ts
// src/lib/validators/contact.ts
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// src/lib/auth/helpers.ts
export type UserRole = (typeof users.$inferSelect)["role"];
```

- Use `type` imports when importing only types:

```ts
import type { CreateContactInput, UpdateContactInput } from "@/lib/validators/contact";
```

- Inline interface definitions at the top of the file for component props and local data shapes; do not export unless another file needs the type
- Use the `SQL[]` type from `drizzle-orm` for dynamically built condition arrays:

```ts
const conditions: SQL[] = [];
if (search) conditions.push(or(...));
const where = conditions.length > 0 ? and(...conditions) : undefined;
```

### Imports

- Path alias `@/` maps to `src/`
- Order: external packages, then `@/lib/...`, then `@/components/...`, then relative
- No barrel `index.ts` files — import from the specific module file:

```ts
import { db } from "@/lib/db";
import { contacts, users } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, asc, type AnyColumn, type SQL } from "drizzle-orm";
```

### Exports

- Page components use `export default function PageName()` (required by Next.js App Router)
- All other components and functions use named exports: `export function ComponentName()`
- Validators export the schema, the input types, and (when needed) an update schema derived via `.partial()`:

```ts
export const createContactSchema = z.object({ ... });
export const updateContactSchema = createContactSchema.partial();
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
```

---

## Component Patterns

### "use client" Directive

All interactive components (forms, pages with state, hooks consumers) carry `"use client"` at the top of the file. Server components do not have this directive. In this codebase, nearly every page and form is a client component because data fetching is done via React Query in the browser.

```ts
// src/components/contacts/contact-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
```

### shadcn/ui Usage

Components are imported from `@/components/ui/*`. Use named destructuring from each primitive:

```ts
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
```

### `cn()` for Conditional Classes

Always use `cn()` from `@/lib/utils` to merge Tailwind classes conditionally:

```ts
// src/components/layout/sidebar.tsx
import { cn } from "@/lib/utils";

className={cn(
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
  isActive
    ? "bg-primary/10 text-primary"
    : "text-muted-foreground hover:bg-muted hover:text-foreground",
  collapsed && "justify-center px-2"
)}
```

### Toast Notifications

Use `sonner` via the named import `toast`:

```ts
import { toast } from "sonner";

toast.success("Contact created");
toast.error(error.message);
```

The `<Toaster />` is mounted once in `src/app/layout.tsx`.

### Data Fetching in Components

Pages fetch data using React Query hooks (from `src/lib/hooks/`). They do not call `fetch` directly. Loading state is handled inline with `<Skeleton>` components:

```ts
// src/app/(dashboard)/contacts/page.tsx
const { data, isLoading } = useContacts({ page, search, type, status });

{isLoading && Array.from({ length: 5 }).map((_, i) => (
  <TableRow key={i}>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    ...
  </TableRow>
))}
```

### Dynamic Route Params (Next.js 16)

Route params are a `Promise` in Next.js 16. Use `use()` in client components:

```ts
// src/app/(dashboard)/contacts/[id]/page.tsx
export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
```

In API route handlers, `await` the params:

```ts
// src/app/api/contacts/[id]/route.ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
```

### Layout Pattern

The dashboard shell is in `src/app/(dashboard)/layout.tsx` — a `"use client"` component that renders `<Sidebar>`, `<TopNav>`, and a `<CommandPalette>`. It manages collapsed/mobile state locally with `useState`. Pages are rendered via `{children}` inside `<main>`.

---

## API Route Patterns

Every route handler follows this exact structure:

```ts
// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listContacts, createContact } from "@/lib/api/contacts";
import { createContactSchema } from "@/lib/validators/contact";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();          // 1. Auth check — throws "Unauthorized" on failure
    const { searchParams } = new URL(request.url);

    // 2. Role-based scoping
    let ownerId = searchParams.get("ownerId") || undefined;
    if (!ownerId && (user.role === "account_manager" || user.role === "ae")) {
      ownerId = user.id;
    }

    const result = await listContacts({ ... });  // 3. Data layer call
    return NextResponse.json(result);            // 4. Return JSON

  } catch (error) {
    // 5. Standardized error handling
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);   // 6. Zod validation

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const contact = await createContact(parsed.data);
    return NextResponse.json(contact, { status: 201 });   // 7. 201 on create

  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Response format conventions:**
- `GET` list: `{ data: [...], pagination: { page, limit, total, totalPages } }`
- `GET` single: the object directly, or `{ error: "Not found" }` with 404
- `POST`: the created object with status 201
- `PATCH`: the updated object
- `DELETE`: `{ success: true }`
- Errors: `{ error: string }` or `{ error: string, details: ... }` with appropriate status code

**Role-based access:** `account_manager` and `ae` roles are automatically scoped to their own records (contacts, deals, tasks). `admin` and `manager` roles see all records.

---

## Data Layer Patterns

All database operations live in `src/lib/api/[resource].ts`. Never call `db` directly from route handlers or components.

### Function Naming

| Operation | Naming |
|---|---|
| List with filters | `listContacts(params)` |
| List scoped to parent | `listDealsByPipeline(pipelineId)` |
| Get single | `getContact(id)` |
| Create | `createContact(data)` |
| Update | `updateContact(id, data)` |
| Delete | `deleteContact(id)` |
| Domain operation | `moveDeal(id, stageId, userId)` |

### Query Patterns

Always use explicit `.select({ ... })` to specify only the columns needed, including joined columns with flat aliases:

```ts
// src/lib/api/contacts.ts
const [data, countResult] = await Promise.all([
  db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      ownerFirstName: users.firstName,   // flat alias for joined column
      ownerLastName: users.lastName,
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerId, users.id))
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset),
  db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(where),
]);
```

Dynamic sort columns require `AnyColumn` type (not a specific column type):

```ts
const sortableColumns: Record<string, AnyColumn> = {
  createdAt: contacts.createdAt,
  firstName: contacts.firstName,
  healthScore: contacts.healthScore,
};
const sortColumn = sortableColumns[sortBy] ?? contacts.createdAt;
const orderFn = sortDir === "asc" ? asc : desc;
```

Use `[result]` destructuring to get the first row from `.returning()`:

```ts
const [contact] = await db.insert(contacts).values({ ... }).returning();
return contact;
```

Use `onConflictDoNothing()` for join table inserts:

```ts
await db.insert(contactTags).values({ contactId, tagId }).onConflictDoNothing();
```

Always set `updatedAt: new Date()` explicitly on updates:

```ts
await db.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
```

### Side Effects in Data Layer

Functions that need to log activity do so directly in the data layer function — not in route handlers:

```ts
// src/lib/api/deals.ts
export async function createDeal(data: CreateDealInput, ownerId: string) {
  const [deal] = await db.insert(deals).values({ ... }).returning();

  // Log activity as a side effect
  await db.insert(activities).values({
    type: "deal_stage_change",
    subject: `Deal created: ${data.title}`,
    contactId: data.contactId,
    dealId: deal.id,
    userId: ownerId,
  });

  return deal;
}
```

---

## Validator Patterns

Validators live in `src/lib/validators/[resource].ts`. Every schema follows the create/update pair pattern:

```ts
// src/lib/validators/contact.ts
import { z } from "zod";

export const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  email: z.string().email().optional().or(z.literal("")),  // allow empty string
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  type: z.enum(["creator", "lead", "enterprise_prospect", "partner"]),
  ownerId: z.string().uuid().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
```

The `.or(z.literal(""))` pattern is used for optional URL/email fields to allow empty strings from form inputs.

For update schemas that need different nullable handling (e.g. clearing a field):

```ts
// src/lib/validators/task.ts
export const updateTaskSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),  // nullable = can be cleared
  dueDate: z.string().datetime().nullable().optional(),
});
```

---

## Hook Patterns

All React Query hooks live in `src/lib/hooks/use-[resource].ts` and are marked `"use client"`.

### useQuery Pattern

```ts
// src/lib/hooks/use-contacts.ts
"use client";

import { useQuery } from "@tanstack/react-query";

export function useContacts(params: ContactListParams = {}) {
  return useQuery({
    queryKey: ["contacts", params],    // resource name + params object
    queryFn: () => fetchContacts(params),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ["contacts", id],        // resource name + id
    queryFn: () => fetchContact(id),
    enabled: !!id,                     // guard against undefined ids
  });
}
```

### useMutation Pattern

```ts
export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateContactInput) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create contact");  // surface API error
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });     // invalidate list
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContactInput }) => {
      const res = await fetch(`/api/contacts/${id}`, { method: "PATCH", ... });
      ...
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });     // invalidate list
      queryClient.invalidateQueries({ queryKey: ["contacts", id] }); // and the detail
    },
  });
}
```

### Query Key Conventions

| Pattern | Example |
|---|---|
| Resource list | `["contacts"]` |
| Resource list with params | `["contacts", params]` |
| Resource detail | `["contacts", id]` |
| Scoped list | `["pipeline", pipelineId]` |
| Cross-invalidation | Mutations invalidate both `["deals"]` and `["pipeline"]` when deals change |

### Fetch Helpers

Local `async function fetchX()` helpers are defined at the top of the hook file — not exported. They handle URL param construction:

```ts
async function fetchContacts(params: ContactListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  const res = await fetch(`/api/contacts?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}
```

---

## Error Handling Patterns

### API Routes

Three levels of error are handled in every route:

1. **Unauthorized** — `requireUser()` throws `new Error("Unauthorized")`, caught and returned as 401
2. **Validation** — `schema.safeParse(body)` returns `.success: false`, returned as 400 with flattened errors
3. **Unexpected** — everything else is logged and returned as 500

```ts
} catch (error) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("GET /api/contacts error:", error);  // always include route name
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

### Mutations in Components

Errors from mutations are surfaced via `toast.error()` in the mutation callback:

```ts
createContact.mutate(form, {
  onSuccess: () => {
    toast.success("Contact created");
    onOpenChange(false);
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

Or inline in `onError` on the mutation definition when the message is generic:

```ts
onError: () => toast.error("Failed to move deal"),
```

### Auth Helpers

```ts
// src/lib/auth/helpers.ts
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}
```

### 404 Handling

```ts
const contact = await getContact(id);
if (!contact) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

---

## State Management Patterns

### React Query (Server State)

All server data is managed through React Query with a global `QueryClient` configured in `src/components/providers/query-provider.tsx`:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,           // 30 seconds before refetch
      refetchOnWindowFocus: false,     // no automatic background refetch
    },
  },
})
```

The provider is instantiated with `useState` to ensure a stable reference:

```ts
const [queryClient] = useState(() => new QueryClient({ ... }));
```

### Local UI State

Form state and filter state are managed with plain `useState`. No external state library is used. Filter state lives in the page component and is passed as params to the query hook:

```ts
// src/app/(dashboard)/contacts/page.tsx
const [search, setSearch] = useState("");
const [typeFilter, setTypeFilter] = useState<string>("all");
const [page, setPage] = useState(1);

const { data, isLoading } = useContacts({
  page,
  search: search || undefined,
  type: typeFilter !== "all" ? typeFilter : undefined,
});
```

Reset `page` to 1 whenever a filter changes:

```ts
onChange={(e) => {
  setSearch(e.target.value);
  setPage(1);
}}
```

### No URL State (Yet)

`nuqs` is installed as a dependency but not yet used in any page. Filter state is in `useState` for now. When URL-persisted filters are needed, migrate to `nuqs` `useQueryState`.

---

## Schema Patterns

### Drizzle Table Definitions

```ts
// src/lib/db/schema.ts

// Enums defined at the top of the file, before tables
export const contactTypeEnum = pgEnum("contact_type", [
  "creator", "lead", "enterprise_prospect", "partner",
]);

// Tables use uuid PK with defaultRandom()
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    // FK references
    ownerId: uuid("owner_id").references(() => users.id),
    // Cascade deletes on child records
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    index("idx_contacts_owner").on(t.ownerId),  // index naming: idx_[table]_[column]
  ]
);

// Relations are defined separately from table definitions
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  owner: one(users, { fields: [contacts.ownerId], references: [users.id] }),
  activities: many(activities),
}));
```

Junction tables use `primaryKey({ columns: [...] })` instead of a separate `id`:

```ts
export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }).notNull(),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);
```

JSONB columns use `.$type<T>()` for TypeScript typing:

```ts
metadata: jsonb("metadata").$type<Record<string, unknown>>(),
options: jsonb("options").$type<{ value: string; label: string; color?: string }[]>(),
```

---

## Utility Patterns

### `cn()` — Class Merging

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Format Utilities

```ts
// src/lib/utils/format.ts
formatCurrency(value: string | number | null | undefined): string
// Returns "$0", "$1.5K", "$2.3M" — handles null/undefined gracefully

formatNumber(value: number | null | undefined): string
// Intl.NumberFormat with locale formatting

getInitials(firstName: string, lastName?: string | null): string
// Returns "NM" for "Nico Marino"
```

Always handle `null | undefined` in format functions — Drizzle decimal fields come back as strings.

---

## Auth Flow

1. `src/proxy.ts` (named `proxy.ts` instead of `middleware.ts` — Next.js 16 convention) protects all non-public routes using Clerk middleware
2. Public routes: `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
3. `getCurrentUser()` in `src/lib/auth/helpers.ts` auto-creates a CRM user record on first Clerk login
4. Every API route calls `requireUser()` as the first step
5. Role-based scoping (`account_manager`, `ae` see only their own records) is enforced in route handlers, not the data layer

---

## Directory Structure

```
src/
  app/
    (auth)/           # Clerk sign-in/sign-up pages
    (dashboard)/      # Protected dashboard pages (layout.tsx wraps all)
      contacts/
        [id]/page.tsx # Detail page
        page.tsx      # List page
      pipeline/
      deals/
      ...
    api/              # API route handlers — one folder per resource
      contacts/
        [id]/route.ts
        route.ts
      deals/
      tasks/
      ...
    layout.tsx        # Root layout (ClerkProvider, QueryProvider, Toaster)
    page.tsx          # Root redirect
  components/
    ui/               # shadcn/ui primitives (never modified)
    contacts/         # Feature-specific components
    pipeline/
    activities/
    layout/           # Shell components (sidebar, top-nav, command-palette)
    providers/        # QueryProvider
  lib/
    api/              # Data access layer — one file per resource
    auth/             # Auth helpers
    db/               # Drizzle client (index.ts) and schema (schema.ts)
    hooks/            # React Query hooks — one file per resource
    validators/       # Zod schemas — one file per resource
    utils/            # Shared utilities
    whop/             # Domain logic (health scores, etc.)
  proxy.ts            # Clerk auth middleware
```
