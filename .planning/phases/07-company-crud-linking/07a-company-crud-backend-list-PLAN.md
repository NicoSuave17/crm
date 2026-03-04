# Phase 7a: Company CRUD Backend + List Page

**Requirements:** COMP-01, COMP-02, COMP-06
**Scope:** Full company data access layer (create, update, delete, get, list with pagination/filters), Zod validators, API routes, React Query hooks, companies list page with filters/search/pagination, create company dialog, and sidebar link.
**Wave:** 1 (no dependencies on 7b or 7c)

---

## Current State Assessment

### What already exists and works:
- **Schema** (`src/lib/db/schema.ts`) — `companies` table with: id, name, domain, industry, size (enum: 1-10, 11-50, 51-200, 201-1000, 1000+), description, linkedinUrl, websiteUrl, ownerId (FK to users), createdAt, updatedAt. Relations defined: owner, contactCompanies, deals.
- **`listCompanies()`** DAL (`src/lib/api/companies.ts`) — Minimal: only returns id/name/domain, only supports search + limit. No pagination, no filters by industry/size/owner, no sorting.
- **`GET /api/companies`** route (`src/app/api/companies/route.ts`) — Passes search + limit to `listCompanies()`. No POST/PATCH/DELETE.
- **`useCompanies()`** hook (`src/lib/hooks/use-companies.ts`) — Fetches all companies (limit 100). No params, no pagination, no mutations.
- **`CompanyPicker`** (`src/components/pickers/company-picker.tsx`) — Uses `useCompanies()`. Works for picking from existing companies. Will continue to work as-is.
- **Sidebar** (`src/components/layout/sidebar.tsx`) — No "Companies" link yet. Needs to be inserted between "Contacts" and "Pipeline" per COMP-06.

### What needs to be built:
1. **Zod validators** — `createCompanySchema` and `updateCompanySchema` (new file)
2. **Extended DAL** — Rewrite `src/lib/api/companies.ts` with: `listCompanies` (paginated + filters), `getCompany` (with owner relation), `createCompany`, `updateCompany`, `deleteCompany`
3. **API routes** — Extend `GET /api/companies` with pagination/filter params, add `POST /api/companies`. New `GET/PATCH/DELETE /api/companies/[id]`.
4. **React Query hooks** — Extend `use-companies.ts` with: `useCompanies(params)` (paginated), `useCompany(id)`, `useCreateCompany()`, `useUpdateCompany()`, `useDeleteCompany()`
5. **Companies list page** — `src/app/(dashboard)/companies/page.tsx` with search, industry filter, size filter, owner filter, pagination, row actions (view/edit/delete), create button
6. **Create company dialog** — `src/components/companies/company-form.tsx`
7. **Sidebar link** — Add "Companies" between Contacts and Pipeline

---

## Implementation Steps

### Step 1: Zod validators
**File:** `src/lib/validators/company.ts` (new)

```ts
import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).optional(),
  description: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  ownerId: z.string().uuid().optional().nullable(),
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
```

Match the pattern from `src/lib/validators/contact.ts` — `z.string().url().optional().or(z.literal(""))` for URL fields.

### Step 2: Extend company DAL
**File:** `src/lib/api/companies.ts` (rewrite)

Replace the existing minimal implementation with full CRUD + paginated list.

**`listCompanies(params)`:**
- Accepts: `{ page, limit, search, industry, size, ownerId, sortBy, sortDir }`
- Search: `ilike` on `name` and `domain` (same as current)
- Filters: `eq` on `industry`, `size`, `ownerId`
- Join `users` for owner name (same pattern as `listContacts`)
- Return shape: `{ data: [...], pagination: { page, limit, total, totalPages } }`
- Select fields: id, name, domain, industry, size, description, linkedinUrl, websiteUrl, ownerId, ownerFirstName, ownerLastName, createdAt, updatedAt
- Sortable columns: createdAt, updatedAt, name
- Default sort: `desc(createdAt)`

**`getCompany(id)`:**
- Select full company row
- Join owner info (id, firstName, lastName, avatarUrl)
- Also query `contactCompanies` + `contacts` to get linked contacts count (for display on detail page later, but include now for forward-compatibility)
- Return: `{ ...company, owner, contactCount }`

**`createCompany(data: CreateCompanyInput)`:**
- Insert into `companies` with `linkedinUrl: data.linkedinUrl || null`, `websiteUrl: data.websiteUrl || null` (same null-coerce pattern as contacts)
- Return the created company

**`updateCompany(id, data: UpdateCompanyInput)`:**
- Update with `updatedAt: new Date()`
- Same null-coerce for URL fields
- Return updated company

**`deleteCompany(id)`:**
- Delete from companies where id matches
- Cascading deletes on `contact_companies` are handled by schema (`onDelete: "cascade"`)
- Deals referencing this company via `companyId` will NOT cascade (no onDelete defined) — they'll just have a null-ish dangling reference. This is acceptable since deals use `companies.id` as an optional FK. The `deals.companyId` column is nullable and has no cascade rule. When a company is deleted, deals with that companyId will still reference the old UUID but the join will return null. **Decision:** Accept this for now — deals don't hard-depend on companies. A future migration could add `onDelete: "set null"` to `deals.companyId`.

### Step 3: API routes — collection
**File:** `src/app/api/companies/route.ts` (rewrite)

**GET handler:**
- Extract params from searchParams: page, limit, search, industry, size, ownerId, sortBy, sortDir
- Role-based filtering: AMs and AEs see only their own companies by default (same pattern as contacts route)
- Call `listCompanies(params)` and return JSON

**POST handler:**
- Parse body with `createCompanySchema.safeParse(body)`
- On validation failure: return 400 with flattened errors
- On success: call `createCompany(parsed.data)` and return 201

Error handling: same try/catch pattern as contacts route (check for "Unauthorized" message, log others as 500).

### Step 4: API routes — individual
**File:** `src/app/api/companies/[id]/route.ts` (new)

**GET handler:**
- Call `getCompany(id)`, return 404 if null
- Pattern: exact same as `src/app/api/contacts/[id]/route.ts`

**PATCH handler:**
- Parse body with `updateCompanySchema.safeParse(body)`
- Call `updateCompany(id, parsed.data)`, return 404 if null
- Return updated company

**DELETE handler:**
- Call `deleteCompany(id)`
- Return `{ success: true }`

Signature pattern: `{ params }: { params: Promise<{ id: string }> }` — Next.js 16 async params.

### Step 5: React Query hooks
**File:** `src/lib/hooks/use-companies.ts` (rewrite)

Replace the existing minimal hook with full CRUD hooks following the exact pattern from `src/lib/hooks/use-contacts.ts`:

**`useCompanies(params)`:**
- queryKey: `["companies", params]`
- Fetches `/api/companies?${searchParams}`
- Params interface: `{ page?, limit?, search?, industry?, size?, ownerId?, sortBy?, sortDir? }`

**`useCompany(id)`:**
- queryKey: `["companies", id]`
- Fetches `/api/companies/${id}`
- `enabled: !!id`

**`useCreateCompany()`:**
- POST to `/api/companies`
- Invalidates `["companies"]` on success

**`useUpdateCompany()`:**
- PATCH to `/api/companies/${id}`
- Invalidates `["companies"]` and `["companies", id]` on success

**`useDeleteCompany()`:**
- DELETE to `/api/companies/${id}`
- Invalidates `["companies"]` on success

**Important:** The existing `useCompanies()` hook (no params) is used by `CompanyPicker`. After rewrite, calling `useCompanies()` with no params will still work — it will default to fetching page 1 with no filters, returning `{ data: [...], pagination: {...} }`. However, **`CompanyPicker` currently expects a flat array** (`data ?? []`). After the rewrite, the response shape changes to `{ data: [...], pagination: {...} }`. We must update `CompanyPicker` to handle the new shape: `(data?.data ?? data ?? [])` or update it to read `.data` from the response. **Decision:** Update `CompanyPicker` to use the new shape. Change line 37 from:
```ts
const companies = (data ?? []) as Array<...>;
```
to:
```ts
const companiesData = (data as { data?: Array<...> })?.data ?? (data as Array<...>) ?? [];
```
Actually, cleaner approach: add an `all` flag to `useCompanies` that returns the flat array format for pickers. Or simply make `CompanyPicker` pass `{ limit: 200 }` and read `data?.data`. **Decision:** Update `CompanyPicker` to read from `data?.data ?? []`.

### Step 6: Update CompanyPicker for new response shape
**File:** `src/components/pickers/company-picker.tsx` (edit)

Change line 37:
```ts
// Before:
const companies = (data ?? []) as Array<{ id: string; name: string; domain: string | null }>;
// After:
const companies = ((data?.data ?? data ?? []) as Array<{ id: string; name: string; domain: string | null }>);
```

This handles both the old flat-array shape (if somehow used) and the new paginated shape.

### Step 7: Create company dialog
**File:** `src/components/companies/company-form.tsx` (new)

Follow the pattern from `src/components/contacts/contact-form.tsx` (for create) and `src/components/contacts/edit-contact-dialog.tsx` (for dialog structure).

**Props:**
```ts
interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Form fields:**
- Name (required) — Input
- Domain — Input (placeholder: "example.com")
- Industry — Input (free text, or Select with common industries — use Input for flexibility)
- Size — Select with enum values: 1-10, 11-50, 51-200, 201-1000, 1000+ (plus a "None" option that maps to undefined)
- Description — Textarea (not Input)
- LinkedIn URL — Input (placeholder: "https://linkedin.com/company/...")
- Website URL — Input (placeholder: "https://...")
- Owner — UserPicker component

**Layout:**
- Name + Domain in a 2-col grid row
- Industry + Size in a 2-col grid row
- Description as full-width textarea
- LinkedIn URL full-width
- Website URL full-width
- Owner full-width (UserPicker)
- Footer: Cancel + Create buttons

**On submit:**
- Call `useCreateCompany().mutate(data)`
- Toast success, close dialog
- Toast error on failure

### Step 8: Companies list page
**File:** `src/app/(dashboard)/companies/page.tsx` (new)

Follow the exact layout/pattern from `src/app/(dashboard)/contacts/page.tsx`:

**State:**
- `createOpen` — boolean for create dialog
- `search` — string
- `industryFilter` — string ("all" | value)
- `sizeFilter` — string ("all" | value)
- `page` — number

**Data fetching:**
- `useCompanies({ page, search, industry, size })`
- `useDeleteCompany()` for row delete action

**Header section:**
- Title: "Companies" / subtitle: "Manage companies and organizations."
- "Add Company" button (opens create dialog)

**Filter bar:**
- Search input with Search icon (same as contacts)
- Industry filter Select — Since industry is free text in the schema, we have two options: (a) hardcode common industries, (b) skip the filter for now. **Decision:** Include an industry text input filter instead of a Select. The API will use `ilike` matching. Actually, the requirement says "filters (industry, size, owner)" so let's use a simple Input for industry search with debounce. For MVP, use a text input for industry filter that sends as a search param. The DAL will do `ilike(companies.industry, '%${industry}%')`.
- Size filter Select — Values: All Sizes, 1-10, 11-50, 51-200, 201-1000, 1000+
- Owner filter — Can use UserPicker or a simpler Select. **Decision:** Skip owner filter in the filter bar for now; the role-based scoping in the API already filters by owner for AMs/AEs. Managers/admins see all.

Revised filter bar:
- Search input (searches name + domain)
- Size filter Select
- Industry text input (searches industry field)

**Table columns:**
- Name (with domain subtitle, link to `/companies/${id}`)
- Industry
- Size (badge)
- Owner (name from ownerFirstName/ownerLastName)
- Actions dropdown (View, Edit, Delete)

**Pagination:**
- Same component pattern as contacts: previous/next buttons, "Page X of Y", "Showing X-Y of Z"

**Row actions:**
- View — Link to `/companies/${id}`
- Edit — (handled in Phase 7b — for now, just link to detail page) **Decision:** Include Edit in dropdown but it will open a dialog. Since the EditCompanyDialog is built in Phase 7b, we have two options: (a) build it here or (b) defer. **Decision:** Build a minimal edit here since COMP-02 and the create form already establish the form fields. The edit dialog is nearly identical. Build `EditCompanyDialog` in this wave.
- Delete — Confirm dialog + `useDeleteCompany()`

### Step 9: Edit company dialog
**File:** `src/components/companies/edit-company-dialog.tsx` (new)

Follow exact pattern from `src/components/contacts/edit-contact-dialog.tsx`:

**Props:**
```ts
interface EditCompanyDialogProps {
  company: {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    description: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
    ownerId: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Form state:** Same fields as create form, pre-filled from `company` prop. `useEffect` resets form when `company` or `open` changes (same pattern as edit-contact-dialog).

**On submit:** Call `useUpdateCompany().mutate({ id, data })`.

### Step 10: Sidebar link
**File:** `src/components/layout/sidebar.tsx` (edit)

Add Companies entry to the `navigation` array between Contacts and Pipeline:

```ts
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Companies", href: "/companies", icon: Building2 },  // NEW
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  // ... rest
];
```

Import `Building2` from `lucide-react` (already used in CompanyPicker, consistent icon choice).

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| COMP-01 | Paginated list of companies with search and filters (industry, size, owner) | Steps 2, 3, 5, 8 — DAL pagination + filters, API params, hooks, list page |
| COMP-02 | Create a company with all fields | Steps 1, 2, 3, 5, 7 — Validator, DAL create, POST route, hook, form dialog |
| COMP-06 | "Companies" link appears in sidebar between Contacts and Pipeline | Step 10 — Sidebar nav array |

**Also partially covered (pulled forward from 7b for completeness):**
| COMP-04 | Edit a company's details | Step 9 — Edit dialog + PATCH route (Step 4) + hook (Step 5) |
| COMP-05 | Delete a company | Steps 2, 4, 5, 8 — DAL delete, DELETE route, hook, row action |

---

## Risks & Decisions

### Industry is free text, not an enum
The schema stores industry as `text("industry")`. Unlike `size` which has a pgEnum, industry has no constraint. For the filter, we use an `ilike` search rather than a dropdown. If the team later wants a fixed industry list, it can be added as a pgEnum migration. For now, free text is more flexible for a CRM.

### CompanyPicker response shape change
The `CompanyPicker` reads `useCompanies()` data as a flat array. After this work, the response becomes `{ data: [...], pagination: {...} }`. Step 6 handles this by updating the picker to read `data?.data ?? []`. This is a breaking change if not done atomically — **all changes must be deployed together**.

### Deals with deleted companies
When a company is deleted, deals referencing `companyId` will have a dangling UUID (no cascade/set-null on `deals.companyId`). The join will return null for the company relation. This is acceptable for an internal tool — the deal still functions, it just loses the company association. A future schema migration can add `onDelete: "set null"`.

### Role-based scoping
AMs and AEs will only see companies they own (same as contacts). Admins and managers see all. This mirrors the contacts API pattern.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Sidebar shows "Companies" link between Contacts and Pipeline with Building2 icon
3. Navigate to `/companies` — shows empty state or list
4. Click "Add Company" — form dialog opens with all fields
5. Create a company — appears in list, toast confirms
6. Search by name or domain — list filters
7. Filter by size — list filters
8. Pagination works (create >25 companies or reduce page size to test)
9. Click company name — navigates to `/companies/[id]` (404 until detail page is built in 7b, but link works)
10. Row dropdown: Edit opens edit dialog, changes save correctly
11. Row dropdown: Delete with confirmation, company removed
12. `CompanyPicker` (in deal form) still works after hook rewrite — verify by opening a deal form and picking a company
