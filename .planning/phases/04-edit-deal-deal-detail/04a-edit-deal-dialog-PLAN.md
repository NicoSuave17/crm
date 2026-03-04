---
phase: 4
plan: "04a-edit-deal-dialog"
title: "Edit Deal Dialog + Wiring"
wave: 1
depends_on: []
files_modified:
  - src/lib/validators/deal.ts
  - src/lib/api/deals.ts
  - src/lib/hooks/use-deals.ts
  - src/components/deals/edit-deal-dialog.tsx
  - src/app/(dashboard)/deals/page.tsx
  - src/app/(dashboard)/deals/[id]/page.tsx
files_read:
  - src/components/contacts/edit-contact-dialog.tsx
  - src/components/pickers/company-picker.tsx
  - src/components/pickers/contact-picker.tsx
  - src/app/api/deals/[id]/route.ts
autonomous: true
requirements:
  - DEAL-01
  - DEAL-02
  - DEAL-03
  - DEAL-04
  - DEAL-05
  - DDET-03
---

# Edit Deal Dialog + Wiring

## Objective
Build an `EditDealDialog` component that pre-fills all deal fields and submits via PATCH, then wire it into the deal detail page ("Edit" button, DDET-03), the deals list page row dropdown ("Edit" item, DEAL-02), and the deal detail page (DEAL-01).

## Context -- What already exists

**Backend (mostly built):**
- `PATCH /api/deals/[id]` -- validates with `updateDealSchema`, calls `updateDeal()`, returns updated deal. Also handles `moveDeal()` when body is `{ stageId }` only. Returns 400 with Zod `details` on validation failure.
- `GET /api/deals/[id]` -- returns raw deal row (all columns from `deals` table). Does NOT join stage/pipeline/contact/company.
- `updateDeal()` in `src/lib/api/deals.ts` -- Drizzle `.update()` with `updatedAt` auto-set.
- `getDeal()` in `src/lib/api/deals.ts` -- returns raw deal row (no joins).

**Frontend (partially built):**
- `useDeals()` hook -- fetches list with joins (stage, pipeline, contact, owner). No `useDeal(id)` hook exists yet.
- `useCreateDeal()` and `useDeleteDeal()` hooks exist. No `useUpdateDeal()` hook.
- Deals list page (`src/app/(dashboard)/deals/page.tsx`) -- table with row dropdown that currently only has "Delete".
- Deal detail page (`src/app/(dashboard)/deals/[id]/page.tsx`) -- **does NOT exist yet**. Must be created in this plan or the companion plan.

**Pickers available:**
- `CompanyPicker` at `src/components/pickers/company-picker.tsx` -- Popover+Command combobox, `value` + `onChange`.
- `ContactPicker` at `src/components/pickers/contact-picker.tsx` -- same pattern.
- `UserPicker` at `src/components/pickers/user-picker.tsx` -- same pattern.

**Pattern to follow:**
- `EditContactDialog` at `src/components/contacts/edit-contact-dialog.tsx` -- same Dialog + form + useEffect reset pattern.

**Validator gap:**
- `updateDealSchema` is `createDealSchema.partial()`. It lacks `lostReason` and `companyId` is only `.optional()` but must support being cleared (set to `null`). Need to extend it with `lostReason` and make `companyId` nullable.

**Hook gap:**
- No `useDeal(id)` hook for fetching a single deal.
- No `useUpdateDeal()` mutation hook.

**Stage lookup for isLost:**
- The edit form needs to conditionally show `lostReason` when the selected stage has `isLost=true`. This requires fetching stages for the current pipeline so we can check the flag.
- Existing `GET /api/pipelines/[id]` or similar must be checked. If not available, the component can fetch stages via the pipeline data already loaded for stage select.

## Pre-flight checks
Before writing any code, read these files to confirm assumptions:
1. `src/lib/validators/deal.ts` -- confirm `updateDealSchema` shape (already read: it's `createDealSchema.partial()`, no lostReason)
2. `src/lib/hooks/use-deals.ts` -- confirm no `useUpdateDeal` exists yet (confirmed)
3. `src/app/api/deals/[id]/route.ts` -- confirm PATCH route accepts partial updates (confirmed)
4. `src/components/contacts/edit-contact-dialog.tsx` -- understand Dialog+form pattern (read)
5. `src/components/pickers/company-picker.tsx` -- confirm `CompanyPickerProps` interface
6. Check if stages/pipeline hooks exist for loading stage options

<tasks>

<task id="1">
**Extend the deal validator with lostReason and make companyId nullable.**

In `src/lib/validators/deal.ts`:

1. Add `lostReason` to `createDealSchema` (or extend `updateDealSchema` separately) so the edit form can submit it:

```ts
export const updateDealSchema = createDealSchema.partial().extend({
  lostReason: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
});
```

This allows the edit form to:
- Send `lostReason` when the selected stage is a lost stage
- Clear `companyId` by sending `null`

Update the `UpdateDealInput` type export accordingly (it already infers from `updateDealSchema`).

Do NOT modify `createDealSchema`.
</task>

<task id="2">
**Add `useDeal(id)` and `useUpdateDeal()` hooks.**

In `src/lib/hooks/use-deals.ts`, add:

```ts
export function useDeal(id: string) {
  return useQuery({
    queryKey: ["deals", id],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${id}`);
      if (!res.ok) throw new Error("Failed to fetch deal");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update deal");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
```

Import `UpdateDealInput` type from `@/lib/validators/deal` for type safety if desired, but the mutation uses `Record<string, unknown>` for flexibility (matching the EditContactDialog pattern).
</task>

<task id="3">
**Enrich the `GET /api/deals/[id]` response with joined data.**

Currently `getDeal()` returns a raw deal row. The deal detail page and edit dialog need related data (stage info including `isLost`, contact name, company name, owner). Two options:

**Option A (recommended):** Create a `getDealWithRelations()` function in `src/lib/api/deals.ts` that returns the deal joined with stage (including `isLost`, `isWon`), pipeline, contact, company, and owner.

```ts
export async function getDealWithRelations(id: string) {
  const [deal] = await db
    .select({
      id: deals.id,
      title: deals.title,
      description: deals.description,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      contactId: deals.contactId,
      companyId: deals.companyId,
      ownerId: deals.ownerId,
      value: deals.value,
      currency: deals.currency,
      expectedMrr: deals.expectedMrr,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      closedAt: deals.closedAt,
      lostReason: deals.lostReason,
      priority: deals.priority,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      // Stage
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      stageIsWon: pipelineStages.isWon,
      stageIsLost: pipelineStages.isLost,
      stageProbability: pipelineStages.probability,
      // Pipeline
      pipelineName: pipelines.name,
      // Contact
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactAvatarUrl: contacts.avatarUrl,
      contactEmail: contacts.email,
      // Company
      companyName: companies.name,
      companyDomain: companies.domain,
      // Owner
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      ownerAvatarUrl: users.avatarUrl,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .where(eq(deals.id, id))
    .limit(1);

  return deal ?? null;
}
```

Add `companies` to the import from schema if not already imported.

**Update the GET route** in `src/app/api/deals/[id]/route.ts` to use `getDealWithRelations` instead of `getDeal`:
```ts
import { getDealWithRelations, updateDeal, deleteDeal, moveDeal } from "@/lib/api/deals";
// ...
const deal = await getDealWithRelations(id);
```

Keep `getDeal()` as-is since `moveDeal()` uses it internally for its lightweight check.
</task>

<task id="4">
**Create the `EditDealDialog` component.**

Create `src/components/deals/edit-deal-dialog.tsx`. Follow the exact EditContactDialog pattern.

**Props interface:**
```ts
interface EditDealDialogProps {
  deal: {
    id: string;
    title: string;
    description: string | null;
    pipelineId: string;
    stageId: string;
    contactId: string;
    companyId: string | null;
    ownerId: string;
    value: string | null;
    expectedMrr: string | null;
    expectedCloseDate: string | null;
    lostReason: string | null;
    priority: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Form state fields:**
- `title` -- text input, required
- `stageId` -- Select dropdown populated from pipeline stages (fetched via API using `deal.pipelineId`). Show stage name + color dot.
- `contactId` -- ContactPicker (read-only display or picker; changing the contact on a deal is unusual but the requirement says "all fields")
- `companyId` -- CompanyPicker (nullable, with clear option)
- `priority` -- Select: low, medium, high, urgent
- `value` -- text input (currency string)
- `expectedMrr` -- text input (currency string)
- `expectedCloseDate` -- date input
- `description` -- Textarea
- `lostReason` -- Textarea, **shown only when the currently selected stage has `isLost=true`**. To determine this, fetch pipeline stages and check the `isLost` flag of the selected `stageId`.

**Conditional lostReason logic:**
- Fetch stages for the deal's pipeline. The simplest approach: use a `useQuery` to fetch stages for `deal.pipelineId`, or pass stages in as a prop.
- Recommended: fetch pipeline stages inside the dialog using `useQuery` with key `["pipeline-stages", deal.pipelineId]`. Query `/api/pipelines?id=PIPELINE_ID` or a dedicated stages endpoint. Check what exists.
- Alternative (simpler): add a `stages` prop to the dialog containing `{ id, name, color, isLost, isWon }[]` fetched by the parent page.
- On stage change, check if the new stage's `isLost` is true. If so, show the `lostReason` field. If not, hide it and clear `lostReason` value.

**Behavior:**
1. On open, initialize form state from `deal` prop via `useEffect` (same as EditContactDialog).
2. On submit, call `useUpdateDeal().mutate({ id: deal.id, data })`.
3. Convert empty strings to `undefined`/`null` appropriately.
4. On success: close dialog, `toast.success("Deal updated")`.
5. On error: `toast.error(error.message)`, dialog stays open.

**Layout:**
- Dialog max width: `sm:max-w-lg`
- Title: full width text input
- Stage + Priority: 2-column grid
- Contact + Company: 2-column grid (pickers)
- Value + Expected MRR: 2-column grid
- Expected Close Date: full width
- Description: full width Textarea
- Lost Reason: full width Textarea (conditional)
- DialogFooter: Cancel + "Save Changes" (disabled while pending)

**Imports:**
- Dialog components from `@/components/ui/dialog`
- Button, Input, Label, Select, Textarea from shadcn
- CompanyPicker from `@/components/pickers/company-picker`
- ContactPicker from `@/components/pickers/contact-picker`
- `useUpdateDeal` from `@/lib/hooks/use-deals`
- `toast` from `sonner`
- `useState, useEffect` from `react`
</task>

<task id="5">
**Create the deal detail page with Edit button (DEAL-01, DDET-03).**

The deal detail page does NOT exist yet. Create `src/app/(dashboard)/deals/[id]/page.tsx`.

Follow the contact detail page pattern (`src/app/(dashboard)/contacts/[id]/page.tsx`) as the structural template.

**Minimal MVP structure (the companion plans will add timeline, stage history, tags, custom fields):**

```tsx
"use client";

import { use, useState } from "react";
import { useDeal } from "@/lib/hooks/use-deals";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: deal, isLoading } = useDeal(id);
  const [editOpen, setEditOpen] = useState(false);
  // ... loading / not found states
  // ... deal profile card with stage badge, value, contact link, company link, owner
  // ... Edit button that opens EditDealDialog
}
```

**Page sections (left column 2/5, right column 3/5 grid):**

Left column:
- Deal profile card: title, stage badge (with color), priority badge, value, expected MRR, expected close date, owner info, description
- Contact card: clickable link to `/contacts/[contactId]` showing name (placeholder for DDET-05, will be enriched in Plan 04c)
- Company card: clickable link to `/companies/[companyId]` showing name (placeholder, same)

Right column:
- Tabs: Timeline (placeholder), Stage History (placeholder) -- will be populated by Plan 04b

Header:
- Back button: "Pipeline" linking to `/pipeline`
- Edit button: opens `EditDealDialog` (DDET-03)

The page must use `useDeal(id)` to fetch the deal with relations (from task 3). The `EditDealDialog` receives the deal object.

This satisfies DEAL-01 (edit from detail) and DDET-03 (edit button on detail page).
</task>

<task id="6">
**Wire the Edit option into the deals list row dropdown (DEAL-02).**

Modify `src/app/(dashboard)/deals/page.tsx`:

1. Import `EditDealDialog`, `Pencil` icon.
2. Add state: `const [editingDeal, setEditingDeal] = useState<...| null>(null)`.
3. Since the deals list query does NOT return all fields needed for the edit form (missing `description`, `companyId`, `expectedMrr`, `lostReason`), use the same fetch-on-click pattern as the contacts list:

```ts
async function handleEdit(dealId: string) {
  try {
    const res = await fetch(`/api/deals/${dealId}`);
    if (!res.ok) throw new Error("Failed to fetch deal");
    const deal = await res.json();
    setEditingDeal(deal);
  } catch {
    toast.error("Failed to load deal for editing");
  }
}
```

4. Add "Edit" dropdown item BEFORE "Delete":
```tsx
<DropdownMenuItem onClick={() => handleEdit(deal.id)}>
  <Pencil className="mr-2 h-4 w-4" />
  Edit
</DropdownMenuItem>
```

5. Render `EditDealDialog` outside the table:
```tsx
{editingDeal && (
  <EditDealDialog
    deal={editingDeal}
    open={!!editingDeal}
    onOpenChange={(open) => { if (!open) setEditingDeal(null); }}
  />
)}
```

This satisfies DEAL-02.
</task>

</tasks>

## Verification
- [ ] `updateDealSchema` accepts `lostReason` (string, optional, nullable) and `companyId` (uuid, optional, nullable)
- [ ] `useDeal(id)` hook fetches a single deal with related data (stage, pipeline, contact, company, owner)
- [ ] `useUpdateDeal()` hook sends PATCH, invalidates deal + deals + pipeline queries
- [ ] `getDealWithRelations()` returns deal with joined stage (including isLost, isWon), contact, company, owner
- [ ] `EditDealDialog` renders with all fields pre-filled from the `deal` prop (DEAL-03)
- [ ] All fields present: title, stageId, contactId, companyId (CompanyPicker), priority, value, expectedMrr, expectedCloseDate, description, lostReason (conditional) (DEAL-04)
- [ ] lostReason field only visible when selected stage has `isLost=true`
- [ ] Submitting sends PATCH to `/api/deals/[id]` (DEAL-05)
- [ ] On success: dialog closes, toast "Deal updated", list/detail reflects new values
- [ ] On error: toast shows error, dialog stays open
- [ ] Deal detail page exists at `/deals/[id]` with Edit button (DEAL-01, DDET-03)
- [ ] Deals list row dropdown has "Edit" option that opens dialog (DEAL-02)
- [ ] CompanyPicker shows current company selection, supports clearing
- [ ] `npm run build` passes

## must_haves
- Edit dialog is a separate component at `src/components/deals/edit-deal-dialog.tsx`
- Pre-fills ALL current deal values on open (DEAL-03)
- Exposes all fields listed in DEAL-04: title, contactId, stageId, priority, value, expectedCloseDate, description, companyId, expectedMrr, lostReason
- lostReason is conditional -- only shown when selected stage's isLost flag is true
- Uses existing PATCH API at `/api/deals/[id]` (DEAL-05)
- Uses CompanyPicker for companyId field
- Uses ContactPicker for contactId field
- Deal detail page created with Edit button (DEAL-01, DDET-03)
- Deals list row dropdown has Edit option (DEAL-02)
- Dialog stays open on validation error
- React Query invalidation covers deals list, single deal, and pipeline queries
- `getDealWithRelations()` enriches the GET response for both the detail page and edit dialog needs

## PLANNING COMPLETE
