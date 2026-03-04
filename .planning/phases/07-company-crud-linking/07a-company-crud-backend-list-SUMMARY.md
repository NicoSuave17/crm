# Summary: 07a — Company CRUD Backend + List Page

**Status:** Complete
**Date:** 2026-03-05

## What Was Built

### 1. Zod Validators (`src/lib/validators/company.ts`)
- `createCompanySchema` with name (required), domain, industry, size (enum), description, linkedinUrl, websiteUrl, ownerId
- `updateCompanySchema` as partial of create schema
- URL fields use `.url().optional().or(z.literal(""))` pattern matching contacts

### 2. Company DAL (`src/lib/api/companies.ts`) — Full Rewrite
- **listCompanies** — Paginated with search (name/domain ilike), industry (ilike), size (exact), ownerId filters. Joins users for owner name. Sortable by createdAt, updatedAt, name.
- **getCompany** — Full company row + owner info + contactCount from contact_companies junction
- **createCompany** — Insert with null-coerce for URL fields
- **updateCompany** — Partial update with updatedAt bump, null-coerce for URL/ownerId
- **deleteCompany** — Simple delete (contact_companies cascade handled by schema)

### 3. API Routes — Collection (`src/app/api/companies/route.ts`) — Rewrite
- **GET** — Paginated with all filter params. Role-based scoping: AMs/AEs see only their companies.
- **POST** — Validates with createCompanySchema, returns 201

### 4. API Routes — Individual (`src/app/api/companies/[id]/route.ts`) — New
- **GET** — Returns company with owner and contactCount, 404 if missing
- **PATCH** — Validates with updateCompanySchema, returns updated company
- **DELETE** — Deletes company, returns { success: true }

### 5. React Query Hooks (`src/lib/hooks/use-companies.ts`) — Full Rewrite
- `useCompanies(params)` — Paginated query with all filter params
- `useCompany(id)` — Single company query
- `useCreateCompany()` — POST mutation, invalidates ["companies"]
- `useUpdateCompany()` — PATCH mutation, invalidates ["companies"] and specific company
- `useDeleteCompany()` — DELETE mutation, invalidates ["companies"]

### 6. CompanyPicker Update (`src/components/pickers/company-picker.tsx`)
- Changed `data ?? []` to `data?.data ?? data ?? []` to handle new paginated response shape
- Backward-compatible with both flat array and paginated object

### 7. Create Company Dialog (`src/components/companies/company-form.tsx`) — New
- All fields: name, domain, industry, size (Select), description (Textarea), linkedinUrl, websiteUrl, owner (UserPicker)
- 2-col layout for name+domain and industry+size rows
- Toast on success/error

### 8. Companies List Page (`src/app/(dashboard)/companies/page.tsx`) — New
- Search input (name/domain), size filter (Select), industry filter (text input)
- Table: name (with domain subtitle + Building2 icon), industry, size (badge), owner
- Row actions: View (link), Edit (fetch-on-click dialog), Delete (confirm)
- Pagination: prev/next buttons, page X of Y, showing range

### 9. Edit Company Dialog (`src/components/companies/edit-company-dialog.tsx`) — New
- Same field layout as create dialog, pre-filled from company prop
- useEffect resets form on open/company change
- Uses useUpdateCompany mutation

### 10. Sidebar Link (`src/components/layout/sidebar.tsx`)
- Added "Companies" with Building2 icon between Contacts and Pipeline

## Verification
- `npm run build` passes with no errors
- `/companies` route registered as static page
- `/api/companies` and `/api/companies/[id]` routes registered

## Requirements Covered
| Req | Description | Status |
|-----|-------------|--------|
| COMP-01 | Paginated list with search and filters | Done |
| COMP-02 | Create a company with all fields | Done |
| COMP-04 | Edit a company's details | Done (pulled forward) |
| COMP-05 | Delete a company | Done |
| COMP-06 | Sidebar link between Contacts and Pipeline | Done |
