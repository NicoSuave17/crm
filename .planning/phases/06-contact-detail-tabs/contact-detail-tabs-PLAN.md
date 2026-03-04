# Phase 6: Contact Detail Tabs — Live Deals & Tasks

**Requirements:** CTAB-01 through CTAB-08
**Scope:** Replace empty Deals/Tasks tab placeholders on the contact detail page with live data tables, status controls, and contextual create buttons.

---

## Current State Assessment

### What already exists and works:
- **Contact detail page** (`src/app/(dashboard)/contacts/[id]/page.tsx`) — Has Deals and Tasks tabs with static placeholder text ("No deals yet" / "No tasks yet")
- **`useDeals({ contactId })`** hook — Already supports `contactId` filter param
- **`useTasks({ contactId })`** hook — Already supports `contactId` filter param
- **`/api/deals?contactId=X`** route — Already passes `contactId` to `listDeals()`
- **`/api/tasks?contactId=X`** route — Already passes `contactId` to `listTasks()`
- **`listDeals({ contactId })`** DAL — Returns: id, title, stageId, stageName, stageColor, pipelineId, pipelineName, contactId, contactFirstName, contactLastName, ownerId, ownerFirstName, ownerLastName, value, priority, expectedCloseDate, createdAt
- **`listTasks({ contactId })`** DAL — Returns: id, title, description, status, priority, assigneeId, assigneeFirstName, assigneeLastName, contactId, contactFirstName, contactLastName, dealId, dueDate, completedAt, createdAt
- **`TaskFormDialog`** (`src/components/tasks/task-form-dialog.tsx`) — Has `defaultContactId` prop, pre-fills contactId on create
- **`DealForm`** (`src/components/pipeline/deal-form.tsx`) — Has `defaultContactId` prop, pre-fills contactId on create. Requires `pipelineId` and `stages[]` as props.
- **`useUpdateTask`** hook — Supports PATCH with `{ status }` for toggle
- **Tasks page** (`src/app/(dashboard)/tasks/page.tsx`) — Has working `handleToggle` pattern using Checkbox + `useUpdateTask`

### What needs to be built:
- Nothing new on the API/hook/DAL side. All data fetching and mutation infrastructure exists.
- The work is entirely in the contact detail page: wire up the hooks, render tables, add create buttons.
- One complication: `DealForm` requires `pipelineId` and `stages[]`. We need to fetch pipelines to pass these. The `usePipelines()` hook exists and returns pipeline list; `usePipelineWithDeals()` returns stages for a given pipeline. We'll use `usePipelines()` to get the default pipeline, then pass its id/stages to `DealForm`.

---

## Implementation Steps

### Step 1: Extract `<ContactDealsTab>` component
**File:** `src/components/contacts/contact-deals-tab.tsx` (new)
**Covers:** CTAB-01, CTAB-02, CTAB-03, CTAB-04

Create a client component that:
1. Accepts `contactId: string` prop
2. Calls `useDeals({ contactId })` to fetch deals filtered by this contact
3. Calls `usePipelines()` to get the default (first) pipeline for the "Add Deal" button
4. Calls `usePipelineWithDeals(pipelineId)` to get stages for the DealForm
5. Renders a mini table with columns: Title (linked to `/pipeline?deal=X` or the deal detail route), Stage (badge with stageColor), Value (formatted currency), Priority (badge), Expected Close Date (formatted)
6. Each deal title is a `<Link>` to `/deals/${deal.id}` (CTAB-03)
7. "Add Deal" button in the CardHeader that opens the existing `DealForm` with `defaultContactId={contactId}`, passing `pipelineId` and `stages` from the fetched pipeline
8. Empty state when no deals: "No deals for this contact."
9. Loading state with skeleton rows

**Type shape for deal rows** (from `listDeals` return):
```ts
{
  id: string;
  title: string;
  stageName: string;
  stageColor: string | null;
  value: string | null;
  priority: string | null;
  expectedCloseDate: string | null;
}
```

**Imports needed:**
- `useDeals` from `@/lib/hooks/use-deals`
- `usePipelines`, `usePipelineWithDeals` from `@/lib/hooks/use-pipeline`
- `DealForm` from `@/components/pipeline/deal-form`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@/components/ui/table`
- `Badge` from `@/components/ui/badge`
- `Button` from `@/components/ui/button`
- `Skeleton` from `@/components/ui/skeleton`
- `format` from `date-fns`
- `formatCurrency` from `@/lib/utils/format`
- `Link` from `next/link`
- `Plus` from `lucide-react`

### Step 2: Extract `<ContactTasksTab>` component
**File:** `src/components/contacts/contact-tasks-tab.tsx` (new)
**Covers:** CTAB-05, CTAB-06, CTAB-07, CTAB-08

Create a client component that:
1. Accepts `contactId: string` prop
2. Calls `useTasks({ contactId })` to fetch tasks filtered by this contact
3. Uses `useUpdateTask()` for the status toggle
4. Renders a table with columns: Checkbox (status toggle), Title (with line-through when completed), Status (badge), Priority (badge), Due Date (formatted, red+icon if overdue), Assignee
5. Checkbox toggles between `completed` and `pending` (same pattern as tasks page `handleToggle`)
6. "Add Task" button in the CardHeader that opens `TaskFormDialog` with `defaultContactId={contactId}`
7. Empty state when no tasks: "No tasks for this contact."
8. Loading state with skeleton rows

**Reuse the exact toggle pattern from the tasks page:**
```ts
function handleToggle(id: string, currentStatus: string) {
  const newStatus = currentStatus === "completed" ? "pending" : "completed";
  updateTask.mutate(
    { id, data: { status: newStatus } },
    { onError: () => toast.error("Failed to update task") }
  );
}
```

**Reuse the priority color map from the tasks page:**
```ts
const priorityColors = { urgent: "destructive", high: "destructive", medium: "secondary", low: "outline" };
```

**Imports needed:**
- `useTasks`, `useUpdateTask` from `@/lib/hooks/use-tasks`
- `TaskFormDialog` from `@/components/tasks/task-form-dialog`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@/components/ui/table`
- `Checkbox` from `@/components/ui/checkbox`
- `Badge` from `@/components/ui/badge`
- `Button` from `@/components/ui/button`
- `Skeleton` from `@/components/ui/skeleton`
- `format, isPast` from `date-fns`
- `Plus, AlertCircle` from `lucide-react`
- `toast` from `sonner`

### Step 3: Wire tabs into contact detail page
**File:** `src/app/(dashboard)/contacts/[id]/page.tsx` (edit)
**Covers:** All CTAB requirements (integration point)

1. Import `ContactDealsTab` and `ContactTasksTab`
2. Replace the Deals tab placeholder content (lines 313-327) with:
   ```tsx
   <TabsContent value="deals" className="mt-4">
     <Card>
       <CardContent className="p-0">
         <ContactDealsTab contactId={id} />
       </CardContent>
     </Card>
   </TabsContent>
   ```
   Note: The CardHeader with title + "Add Deal" button will be inside the `ContactDealsTab` component itself, so we can simplify the wrapper. Alternatively, keep the Card wrapper in the page and have the tab components render just the table + button. Decision: Let the tab components own their own Card header + content for encapsulation, and remove the Card wrapper from the page.

   Simplified replacement:
   ```tsx
   <TabsContent value="deals" className="mt-4">
     <ContactDealsTab contactId={id} />
   </TabsContent>
   ```

3. Replace the Tasks tab placeholder content (lines 329-343) with:
   ```tsx
   <TabsContent value="tasks" className="mt-4">
     <ContactTasksTab contactId={id} />
   </TabsContent>
   ```

4. Add imports at the top of the file:
   ```tsx
   import { ContactDealsTab } from "@/components/contacts/contact-deals-tab";
   import { ContactTasksTab } from "@/components/contacts/contact-tasks-tab";
   ```

5. Remove unused imports that were only needed for the placeholder (none in this case -- the Card/CardHeader/etc. are still used by the Timeline tab).

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| CTAB-01 | Deals tab shows actual deals where contactId matches | Step 1 — `useDeals({ contactId })` |
| CTAB-02 | Deals tab displays as mini table: title, stage, value, priority, expected close date | Step 1 — table columns |
| CTAB-03 | Each deal row links to deal detail page | Step 1 — Link on title |
| CTAB-04 | Deals tab has "Add Deal" button that opens DealForm pre-filled with contactId | Step 1 — DealForm with `defaultContactId` |
| CTAB-05 | Tasks tab shows actual tasks where contactId matches | Step 2 — `useTasks({ contactId })` |
| CTAB-06 | Tasks tab displays: title, status, priority, due date, assignee | Step 2 — table columns |
| CTAB-07 | Tasks tab has status toggle checkbox | Step 2 — Checkbox + handleToggle |
| CTAB-08 | Tasks tab has "Add Task" button that opens TaskForm pre-filled with contactId | Step 2 — TaskFormDialog with `defaultContactId` |

---

## Risks & Decisions

### DealForm requires pipelineId + stages
The `DealForm` component requires `pipelineId` and `stages[]` as mandatory props. When creating a deal from the contact detail page, we need to pick a pipeline. **Decision:** Use `usePipelines()` to fetch all pipelines and default to the first one. If there are multiple pipelines, show a pipeline selector dropdown above the DealForm, or within it. Since `DealForm` already handles stage selection internally, we just need to pass the correct pipeline context. If no pipelines exist, disable the "Add Deal" button and show a tooltip explaining pipelines need to be created first.

### Deal detail route
CTAB-03 says "each deal row links to deal detail page." Confirmed: the deal detail page exists at `src/app/(dashboard)/deals/[id]/page.tsx`, so links should point to `/deals/${deal.id}`.

### No new API endpoints needed
All filtering is already supported. This is purely a frontend wiring task.

---

## Verification

After implementation:
1. Navigate to a contact detail page
2. Click "Deals" tab — should show deals table or empty state
3. Click "Add Deal" — DealForm opens with contactId pre-filled
4. Create a deal — it appears in the table
5. Click deal title — navigates to deal detail page
6. Click "Tasks" tab — should show tasks table or empty state
7. Click "Add Task" — TaskFormDialog opens with contactId pre-filled
8. Create a task — it appears in the table
9. Click checkbox on a task — toggles between completed/pending
10. Verify overdue tasks show red styling with alert icon
11. `npm run build` passes with no errors
