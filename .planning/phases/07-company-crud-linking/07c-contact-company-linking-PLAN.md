# Phase 7c: Contact-Company Linking

**Requirements:** LINK-01, LINK-02, LINK-03, LINK-04
**Scope:** API for linking/unlinking contacts and companies (via `contact_companies` junction table), UI for managing links from both contact detail and company detail pages, including role field and picker dialogs.
**Wave:** 2 (depends on 7a for company hooks/API; depends on 7b for company detail page where LINK-04 renders)

---

## Current State Assessment

### What already exists:
- **Schema** (`src/lib/db/schema.ts`) — `contactCompanies` table with: contactId (FK, cascade delete), companyId (FK, cascade delete), role (text, nullable), isPrimary (boolean, default false). Composite primary key on (contactId, companyId). Relations defined: contact, company.
- **Relations** — `contacts` has `contactCompanies: many(contactCompanies)`. `companies` has `contactCompanies: many(contactCompanies)`. Junction table has `contact` and `company` one-relations.
- **`CompanyPicker`** (`src/components/pickers/company-picker.tsx`) — Searchable dropdown for selecting a company. Will be reused in the "Link Company" dialog.
- **Contact detail page** (`src/app/(dashboard)/contacts/[id]/page.tsx`) — Has profile card in left column. The "Companies" section needs to be added here (LINK-01).
- **Company detail page** (`src/app/(dashboard)/companies/[id]/page.tsx`) — Built in 7b. Has a Contacts tab placeholder. LINK-04 fills this.
- **`getCompany(id)`** DAL from 7a — Returns `contactCount`. For LINK-04, we need the actual linked contacts, not just a count.

### What needs to be built:
1. **Link/unlink DAL functions** — `linkContactCompany()`, `unlinkContactCompany()`, `getContactCompanies(contactId)`, `getCompanyContacts(companyId)`
2. **API routes** — `POST /api/contacts/[id]/companies` (link), `DELETE /api/contacts/[id]/companies/[companyId]` (unlink), `GET /api/contacts/[id]/companies` (list linked companies), `GET /api/companies/[id]/contacts` (list linked contacts)
3. **React Query hooks** — `useContactCompanies(contactId)`, `useLinkCompany()`, `useUnlinkCompany()`, `useCompanyContacts(companyId)`
4. **Link company dialog** — Picker dialog with company search + role field
5. **Contact detail "Companies" section** — Shows linked companies with role, link/unlink actions
6. **Company detail "Contacts" section** — Shows linked contacts

---

## Implementation Steps

### Step 1: DAL functions for contact-company links
**File:** `src/lib/api/contact-companies.ts` (new)

**`getContactCompanies(contactId: string)`:**
```ts
// Returns companies linked to a contact with role info
// Join contactCompanies -> companies for company details
// Select: companyId, company.name, company.domain, company.industry, role, isPrimary
```
- Query `contactCompanies` where `contactId` matches
- Inner join `companies` on `contactCompanies.companyId = companies.id`
- Return array of `{ companyId, name, domain, industry, role, isPrimary }`

**`getCompanyContacts(companyId: string)`:**
```ts
// Returns contacts linked to a company with role info
// Join contactCompanies -> contacts for contact details
// Select: contactId, contact.firstName, contact.lastName, contact.email, contact.avatarUrl, contact.type, role, isPrimary
```
- Query `contactCompanies` where `companyId` matches
- Inner join `contacts` on `contactCompanies.contactId = contacts.id`
- Return array of `{ contactId, firstName, lastName, email, avatarUrl, type, role, isPrimary }`

**`linkContactCompany(contactId: string, companyId: string, role?: string)`:**
- Insert into `contactCompanies` with `{ contactId, companyId, role }`
- Use `onConflictDoUpdate` to update role if the link already exists (since PK is (contactId, companyId)):
  ```ts
  .onConflictDoUpdate({
    target: [contactCompanies.contactId, contactCompanies.companyId],
    set: { role: role ?? null },
  })
  ```
- Return the inserted/updated row

**`unlinkContactCompany(contactId: string, companyId: string)`:**
- Delete from `contactCompanies` where both `contactId` and `companyId` match:
  ```ts
  await db.delete(contactCompanies)
    .where(and(
      eq(contactCompanies.contactId, contactId),
      eq(contactCompanies.companyId, companyId)
    ));
  ```

### Step 2: Zod validator for link input
**File:** `src/lib/validators/contact-company.ts` (new)

```ts
import { z } from "zod";

export const linkContactCompanySchema = z.object({
  companyId: z.string().uuid("Invalid company ID"),
  role: z.string().optional(),
});

export type LinkContactCompanyInput = z.infer<typeof linkContactCompanySchema>;
```

### Step 3: API routes for contact -> companies
**File:** `src/app/api/contacts/[id]/companies/route.ts` (new)

**GET handler:**
- Call `getContactCompanies(id)`
- Return JSON array

**POST handler:**
- Parse body with `linkContactCompanySchema.safeParse(body)`
- Call `linkContactCompany(id, parsed.data.companyId, parsed.data.role)`
- Return 201 with the link record

Error handling: standard try/catch pattern (Unauthorized check, 400 for validation, 500 for server error).

### Step 4: API route for unlinking
**File:** `src/app/api/contacts/[id]/companies/[companyId]/route.ts` (new)

**DELETE handler:**
- Extract `id` (contactId) and `companyId` from params
- Call `unlinkContactCompany(id, companyId)`
- Return `{ success: true }`

Signature: `{ params }: { params: Promise<{ id: string; companyId: string }> }`

### Step 5: API route for company -> contacts
**File:** `src/app/api/companies/[id]/contacts/route.ts` (new)

**GET handler:**
- Call `getCompanyContacts(id)`
- Return JSON array

### Step 6: React Query hooks
**File:** `src/lib/hooks/use-contact-companies.ts` (new)

**`useContactCompanies(contactId: string)`:**
- queryKey: `["contact-companies", contactId]`
- Fetches `GET /api/contacts/${contactId}/companies`
- `enabled: !!contactId`

**`useLinkCompany()`:**
- POST to `/api/contacts/${contactId}/companies`
- MutationFn accepts `{ contactId, companyId, role? }`
- Invalidates `["contact-companies", contactId]` and `["company-contacts"]` on success

**`useUnlinkCompany()`:**
- DELETE to `/api/contacts/${contactId}/companies/${companyId}`
- MutationFn accepts `{ contactId, companyId }`
- Invalidates `["contact-companies", contactId]` and `["company-contacts"]` on success

**`useCompanyContacts(companyId: string)`:**
- queryKey: `["company-contacts", companyId]`
- Fetches `GET /api/companies/${companyId}/contacts`
- `enabled: !!companyId`

### Step 7: Link company dialog
**File:** `src/components/contacts/link-company-dialog.tsx` (new)

A dialog for linking a company to a contact. Opened from the contact detail page.

**Props:**
```ts
interface LinkCompanyDialogProps {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompanyIds: string[]; // to filter out already-linked companies
}
```

**Dialog content:**
- Title: "Link Company"
- CompanyPicker — for selecting the company. Filter out `existingCompanyIds` from the list. **Implementation:** The CompanyPicker doesn't currently support excluding IDs. Two options: (a) filter client-side after data loads, (b) pass an exclude list. **Decision:** Filter client-side in the dialog. After selecting a company from the picker, check if it's in `existingCompanyIds` and show an error if so. Or, simpler: let the upsert handle it (since `linkContactCompany` uses `onConflictDoUpdate`, re-linking just updates the role). So no filtering needed — re-selecting an already-linked company just updates the role. Show a note: "Selecting an already-linked company will update the role."
- Role input — free text Input with placeholder "e.g. CEO, CTO, Founder, Employee"
- Footer: Cancel + Link buttons

**On submit:**
```ts
linkCompany.mutate(
  { contactId, companyId: selectedCompanyId, role: role || undefined },
  {
    onSuccess: () => {
      toast.success("Company linked");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to link company"),
  }
);
```

### Step 8: Contact detail — Companies section
**File:** `src/app/(dashboard)/contacts/[id]/page.tsx` (edit)

Add a "Companies" section to the left column, below the Tags section and above or below Custom Fields.

**Location:** After the Tags `<Separator>` and `<TagSelector>`, add another `<Separator>` and the Companies section.

**Content:**
1. Section header: "Companies" label + "Link" button (small, outline)
2. If linked companies exist: render a list of company cards, each showing:
   - Building2 icon + company name (linked to `/companies/${companyId}`)
   - Role (muted text, if present)
   - Domain (muted text, if present)
   - Unlink button (X icon, small ghost button) — calls `useUnlinkCompany()`
3. If no linked companies: muted text "No companies linked."

**Data fetching:** Add `useContactCompanies(id)` call in the page component.

**New state:** `linkCompanyOpen` boolean for the dialog.

**Imports to add:**
- `useContactCompanies`, `useUnlinkCompany` from `@/lib/hooks/use-contact-companies`
- `LinkCompanyDialog` from `@/components/contacts/link-company-dialog`
- `Building2, Link2` from `lucide-react`

**Unlink confirmation:** Use a simple confirm() dialog: `"Unlink {companyName} from this contact?"`.

### Step 9: Company detail — Contacts section
**File:** `src/app/(dashboard)/companies/[id]/page.tsx` (edit — built in 7b)

Replace the Contacts tab placeholder with actual linked contacts data.

**Two options for where to show this:**
1. As a tab in the right column (alongside Timeline and Deals)
2. As a section in the left column profile card

**Decision:** Show as a tab in the right column. The contact detail page puts companies in the left profile card because companies are a small supplementary piece of info. But on the company detail page, contacts are a primary entity — there could be many linked contacts. A tab is more appropriate.

**Contacts tab content:**
1. Use `useCompanyContacts(id)` to fetch linked contacts
2. Render a table (or list) of contacts:
   - Avatar + Name (linked to `/contacts/${contactId}`)
   - Email
   - Type (badge)
   - Role at this company (from the link record)
3. Empty state: "No contacts linked to this company."
4. No "Link Contact" button from the company side (linking is done from the contact side per LINK-02). This is a read-only view. **Reconsideration:** It would be useful to also link from the company side. But LINK-02 only specifies linking from the contact detail page. Keep it read-only here for now. Can add a "Link Contact" flow in a future iteration if needed.

**Component:** Extract as `src/components/companies/company-contacts-tab.tsx` for encapsulation.

**Props:** `companyId: string`

**Data shape from `getCompanyContacts`:**
```ts
{
  contactId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  type: string;
  role: string | null;
  isPrimary: boolean;
}
```

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| LINK-01 | Contact detail page shows "Companies" section with linked companies and role | Step 8 — Companies section in left column |
| LINK-02 | User can link a company to a contact via picker dialog with company search + role field | Step 7 (dialog) + Step 8 (integration) |
| LINK-03 | User can unlink a company from a contact | Step 8 — Unlink button on each linked company |
| LINK-04 | Company detail page shows "Contacts" section with linked contacts | Step 9 — Contacts tab in company detail |

---

## Risks & Decisions

### Linking direction
LINK-02 specifies linking from the contact side (contact detail -> pick a company). The reverse (company detail -> pick a contact) is not in scope. LINK-04 is read-only from the company side.

### Re-linking / role updates
If a user links an already-linked company, the `onConflictDoUpdate` in the DAL will just update the role. This is the cleanest UX — no error, just an update.

### isPrimary flag
The `contact_companies` schema has an `isPrimary` boolean. This plan does not expose it in the UI. It's stored in the DB and can be used later for "primary company" display logic. For now, all links are treated equally.

### Nested API routes
The routes follow REST conventions: `/api/contacts/[id]/companies` for the contact's companies. This is consistent with how a CRM would model sub-resources. The Next.js 16 file structure supports this via nested `[id]/companies/route.ts` directories.

### Query key invalidation
When linking/unlinking, we invalidate both `["contact-companies", contactId]` and `["company-contacts"]` (broad invalidation of all company contact queries). This ensures both the contact detail and company detail pages reflect changes. The broad invalidation on `company-contacts` is acceptable since these queries are small and infrequent.

---

## Verification

After implementation:
1. `npm run build` passes
2. Navigate to a contact detail page — "Companies" section appears in left column
3. Click "Link" — dialog opens with CompanyPicker + role field
4. Select a company and optionally enter a role — click Link — company appears in the section
5. Linked company shows: name (clickable to company detail), role, domain
6. Click X (unlink) on a linked company — confirmation — company removed from section
7. Navigate to the linked company's detail page — Contacts tab shows the contact
8. Link multiple companies to one contact — all appear
9. Link one company to multiple contacts — company detail shows all contacts
10. Re-link with a different role — role updates (no duplicate)
11. Delete a company (from 7a/7b) — contact detail no longer shows it (cascade delete on junction table)
12. Delete a contact — company detail no longer shows it (cascade delete on junction table)
