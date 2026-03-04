---
phase: 5
plan: "05a-task-form"
title: "Task Form Backend + Component + Wiring"
wave: 1
depends_on: []
files_modified:
  - src/lib/api/tasks.ts
  - src/app/api/tasks/[id]/route.ts
  - src/lib/hooks/use-tasks.ts
  - src/components/tasks/task-form-dialog.tsx
  - src/app/(dashboard)/tasks/page.tsx
files_read:
  - src/lib/db/schema.ts
  - src/lib/validators/task.ts
  - src/app/api/tasks/route.ts
  - src/components/contacts/edit-contact-dialog.tsx
  - src/components/deals/edit-deal-dialog.tsx
  - src/components/pickers/user-picker.tsx
  - src/components/pickers/contact-picker.tsx
  - src/components/pickers/deal-picker.tsx
autonomous: true
requirements:
  - TASK-01
  - TASK-02
  - TASK-03
  - TASK-04
  - TASK-05
---

# Task Form Backend + Component + Wiring

## Objective
Build the backend GET endpoint for a single task, create a reusable `TaskFormDialog` component that handles both create and edit modes with all fields (title, description, status, priority, dueDate, assigneeId, contactId, dealId), and wire it into the tasks list page replacing the minimal create dialog and adding edit capability via the row dropdown.

## Context -- What already exists

**Backend (partially built):**
- `POST /api/tasks` -- validates with `createTaskSchema`, calls `createTask()`. Works.
- `PATCH /api/tasks/[id]` -- validates with `updateTaskSchema`, calls `updateTask()`. Works.
- `DELETE /api/tasks/[id]` -- calls `deleteTask()`. Works.
- **NO `GET /api/tasks/[id]`** -- this is the gap. The `[id]/route.ts` file exists with PATCH and DELETE handlers but no GET handler (TASK-05).
- `listTasks()` in `src/lib/api/tasks.ts` -- returns tasks with joined assignee and contact names. No `getTask(id)` function exists.
- `updateTask()` in `src/lib/api/tasks.ts` -- handles status/dueDate transformations, returns updated row.

**Validators (complete):**
- `createTaskSchema` -- title (required), description, priority, contactId, dealId, assigneeId, dueDate (all optional).
- `updateTaskSchema` -- all fields optional; status (enum), contactId/dealId are nullable+optional, dueDate is nullable+optional.
- Types `CreateTaskInput` and `UpdateTaskInput` already exported.

**Frontend hooks (partially built):**
- `useTasks(params)` -- list query with filters.
- `useCreateTask()` -- POST mutation, invalidates `["tasks"]`.
- `useUpdateTask()` -- PATCH mutation to `/api/tasks/${id}`, invalidates `["tasks"]`.
- `useDeleteTask()` -- DELETE mutation, invalidates `["tasks"]`.
- **NO `useTask(id)` hook** for fetching a single task.

**Tasks list page (`src/app/(dashboard)/tasks/page.tsx`):**
- Has a table with checkbox toggle, priority badge, contact link, due date, assignee.
- Has a minimal create dialog with ONLY: title, priority, dueDate. Missing: description, status, assigneeId, contactId, dealId.
- Row dropdown has ONLY "Delete". Missing: "Edit" option.
- The create dialog is inline in the page (not a separate component).

**Pickers available:**
- `UserPicker` -- `value: string | null`, `onChange: (userId: string | null) => void`.
- `ContactPicker` -- `value: string | null`, `onChange: (contactId: string | null) => void`.
- `DealPicker` -- `value: string | null`, `onChange: (dealId: string | null) => void`.

**Pattern to follow:**
- `EditContactDialog` at `src/components/contacts/edit-contact-dialog.tsx` -- Dialog + form + `useEffect` reset on open.
- `EditDealDialog` at `src/components/deals/edit-deal-dialog.tsx` -- same pattern, with conditional fields and pickers.

**Key differences from contact/deal dialogs:**
- The TaskFormDialog must support BOTH create and edit modes (not separate components). This is because Phase 6 (Contact Detail Tabs) needs to render TaskForm with a pre-filled `contactId` for creating tasks from a contact's Tasks tab. A unified component is cleaner.
- In create mode: no task data to pre-fill, submit calls `useCreateTask()`.
- In edit mode: pre-fill all fields from fetched task, submit calls `useUpdateTask()`.

## Pre-flight checks
Before writing any code, read these files to confirm assumptions:
1. `src/app/api/tasks/[id]/route.ts` -- confirmed: PATCH and DELETE exist, no GET (verified)
2. `src/lib/api/tasks.ts` -- confirmed: no `getTask(id)` function (verified)
3. `src/lib/hooks/use-tasks.ts` -- confirmed: no `useTask(id)` hook (verified)
4. `src/lib/validators/task.ts` -- confirmed: both schemas exist with proper shapes (verified)
5. `src/components/pickers/user-picker.tsx` -- confirmed: `UserPickerProps` interface with `value`/`onChange` (verified)
6. `src/components/pickers/contact-picker.tsx` -- confirmed: `ContactPickerProps` interface (verified)
7. `src/components/pickers/deal-picker.tsx` -- confirmed: `DealPickerProps` interface (verified)

<tasks>

<task id="1">
**Add `getTask(id)` function to the data access layer.**

In `src/lib/api/tasks.ts`, add a function that fetches a single task by ID with joined assignee and contact names (matching the shape returned by `listTasks` so the UI can display names consistently).

```ts
export async function getTask(id: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      creatorId: tasks.creatorId,
      contactId: tasks.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      dealId: tasks.dealId,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return task ?? null;
}
```

This returns the same column shape as `listTasks` plus `description`, `creatorId`, `completedAt`, and `updatedAt` (which are useful for the edit form and future detail views). Import `deals` table if needed for a deal name join -- but the DealPicker handles display on the frontend, so joining deal is not required here.
</task>

<task id="2">
**Add GET handler to `/api/tasks/[id]/route.ts`.**

In `src/app/api/tasks/[id]/route.ts`, add a GET handler:

```ts
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const task = await getTask(id);

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Update the import line at the top to include `getTask`:
```ts
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";
```

This satisfies TASK-05.
</task>

<task id="3">
**Add `useTask(id)` hook.**

In `src/lib/hooks/use-tasks.ts`, add a hook for fetching a single task:

```ts
export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
    enabled: !!id,
  });
}
```

This will be used by the edit dialog to fetch full task data when opened from the list row dropdown (the list query doesn't include `description`).
</task>

<task id="4">
**Create the `TaskFormDialog` component.**

Create `src/components/tasks/task-form-dialog.tsx`. This is a unified create/edit dialog.

**Props interface:**
```ts
interface TaskFormDialogProps {
  /** When provided, the dialog operates in edit mode with pre-filled values. */
  task?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigneeId: string;
    contactId: string | null;
    dealId: string | null;
    dueDate: string | null;
  } | null;
  /** Pre-fill contactId when creating from a contact detail tab (Phase 6). */
  defaultContactId?: string;
  /** Pre-fill dealId when creating from a deal detail tab (future). */
  defaultDealId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Form state fields:**
- `title` -- text input, required
- `description` -- Textarea, optional
- `status` -- Select dropdown: pending, in_progress, completed, cancelled. Only shown in edit mode (new tasks default to "pending").
- `priority` -- Select dropdown: low, medium, high, urgent. Default: "medium".
- `dueDate` -- date input, optional
- `assigneeId` -- UserPicker, optional (when omitted on create, backend defaults to current user)
- `contactId` -- ContactPicker, optional/nullable
- `dealId` -- DealPicker, optional/nullable

**Mode determination:**
- Edit mode: `task` prop is provided and non-null.
- Create mode: `task` prop is `undefined` or `null`.

**Behavior:**

_Create mode:_
1. On open, initialize form with defaults: title="", description="", priority="medium", status="pending", dueDate="", assigneeId=undefined, contactId=defaultContactId or null, dealId=defaultDealId or null.
2. On submit, call `useCreateTask().mutate(data)` where data is a `CreateTaskInput`.
3. On success: close dialog, `toast.success("Task created")`, reset form.
4. On error: `toast.error("Failed to create task")`, dialog stays open.

_Edit mode:_
1. On open, initialize form from `task` prop via `useEffect` (same pattern as EditContactDialog).
2. On submit, call `useUpdateTask().mutate({ id: task.id, data })` where data is an `UpdateTaskInput`.
3. On success: close dialog, `toast.success("Task updated")`.
4. On error: `toast.error(error.message)`, dialog stays open.

**useEffect reset logic:**
```ts
useEffect(() => {
  if (open) {
    if (task) {
      // Edit mode: populate from task
      setForm({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
        assigneeId: task.assigneeId,
        contactId: task.contactId ?? null,
        dealId: task.dealId ?? null,
      });
    } else {
      // Create mode: reset to defaults
      setForm({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        dueDate: "",
        assigneeId: undefined,
        contactId: defaultContactId ?? null,
        dealId: defaultDealId ?? null,
      });
    }
  }
}, [open, task, defaultContactId, defaultDealId]);
```

**Submit handler:**
```ts
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!form.title.trim()) return;

  const isEdit = !!task;

  if (isEdit) {
    const data: UpdateTaskInput = {
      title: form.title,
      description: form.description || undefined,
      status: form.status as UpdateTaskInput["status"],
      priority: form.priority as UpdateTaskInput["priority"],
      assigneeId: form.assigneeId || undefined,
      contactId: form.contactId || null,
      dealId: form.dealId || null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
    };

    updateTask.mutate(
      { id: task!.id, data },
      {
        onSuccess: () => {
          toast.success("Task updated");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  } else {
    const data: CreateTaskInput = {
      title: form.title,
      description: form.description || undefined,
      priority: form.priority as CreateTaskInput["priority"],
      assigneeId: form.assigneeId || undefined,
      contactId: form.contactId || undefined,
      dealId: form.dealId || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
    };

    createTask.mutate(data, {
      onSuccess: () => {
        toast.success("Task created");
        onOpenChange(false);
      },
      onError: () => toast.error("Failed to create task"),
    });
  }
}
```

**Layout (Dialog max width: `sm:max-w-lg`):**
```
DialogHeader: "Create Task" or "Edit Task" (based on mode)

- Title: full-width Input, required
- Description: full-width Textarea, 3 rows
- Status + Priority: 2-column grid
  - Status: Select (only in edit mode; in create mode, render Priority full-width or show Status as disabled "Pending")
  - Priority: Select
- Due Date: full-width date Input
- Assignee: full-width UserPicker
- Contact + Deal: 2-column grid
  - Contact: ContactPicker
  - Deal: DealPicker

DialogFooter: Cancel + "Create" or "Save Changes" (disabled while pending)
```

**Status field visibility:**
- In create mode: hide the status field entirely (tasks always start as "pending"). Show priority full-width instead of in a 2-col grid.
- In edit mode: show status Select with all four enum values.

**Imports:**
- Dialog components from `@/components/ui/dialog`
- Button, Input, Label, Textarea, Select from shadcn
- UserPicker from `@/components/pickers/user-picker`
- ContactPicker from `@/components/pickers/contact-picker`
- DealPicker from `@/components/pickers/deal-picker`
- `useCreateTask`, `useUpdateTask` from `@/lib/hooks/use-tasks`
- `toast` from `sonner`
- `useState`, `useEffect` from `react`
- Types `CreateTaskInput`, `UpdateTaskInput` from `@/lib/validators/task`

This satisfies TASK-01 (create via TaskForm), TASK-02 (edit via TaskForm), TASK-03 (all fields exposed), and TASK-04 (pre-fills values in edit mode).
</task>

<task id="5">
**Wire the TaskFormDialog into the tasks list page -- replace create dialog and add edit.**

Modify `src/app/(dashboard)/tasks/page.tsx`:

**Remove the inline create dialog.** Delete all the inline create state (`newTitle`, `newPriority`, `newDueDate`), the `handleCreate` function, and the inline `<Dialog>` JSX at the bottom of the file.

**Import and use TaskFormDialog for create:**
```ts
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
```

Replace the inline dialog state with:
```ts
const [createOpen, setCreateOpen] = useState(false);
```

Replace the inline Dialog with:
```tsx
<TaskFormDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
/>
```

The "Add Task" button in the header already sets `createOpen` -- keep that wiring.

**Add edit capability:**

1. Add state for the task being edited:
```ts
const [editingTask, setEditingTask] = useState<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string;
  contactId: string | null;
  dealId: string | null;
  dueDate: string | null;
} | null>(null);
```

2. Add a fetch-on-click handler (the list query doesn't include `description`):
```ts
async function handleEdit(taskId: string) {
  try {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) throw new Error("Failed to fetch task");
    const task = await res.json();
    setEditingTask(task);
  } catch {
    toast.error("Failed to load task for editing");
  }
}
```

3. Add "Edit" option to the row dropdown BEFORE "Delete":
```tsx
<DropdownMenuItem onClick={() => handleEdit(task.id)}>
  Edit
</DropdownMenuItem>
```

4. Import `Pencil` from lucide-react for the edit icon (optional, the contact/deal patterns vary on this).

5. Render the edit dialog outside the table:
```tsx
<TaskFormDialog
  task={editingTask}
  open={!!editingTask}
  onOpenChange={(open) => { if (!open) setEditingTask(null); }}
/>
```

**Summary of changes to page.tsx:**
- Remove: `newTitle`, `newPriority`, `newDueDate` state variables
- Remove: `handleCreate` function
- Remove: Inline create `<Dialog>` JSX (lines ~266-308)
- Add: `TaskFormDialog` import
- Add: `editingTask` state
- Add: `handleEdit` function
- Add: "Edit" dropdown menu item in each row
- Add: Two `<TaskFormDialog>` renders (one for create, one for edit)
- Keep: `createOpen` state and "Add Task" button wiring
- Keep: `handleToggle`, `handleDelete` functions unchanged
</task>

</tasks>

## Verification
- [ ] `getTask(id)` returns a single task with joined assignee and contact names
- [ ] `GET /api/tasks/[id]` returns the task JSON or 404 if not found (TASK-05)
- [ ] `useTask(id)` hook fetches a single task with `enabled: !!id`
- [ ] `TaskFormDialog` in create mode shows: title, description, priority, dueDate, assigneeId (UserPicker), contactId (ContactPicker), dealId (DealPicker) -- no status field (TASK-01, TASK-03)
- [ ] `TaskFormDialog` in edit mode shows all above fields PLUS status (TASK-02, TASK-03, TASK-04)
- [ ] Edit mode pre-fills all current task values from the `task` prop (TASK-04)
- [ ] Create mode accepts optional `defaultContactId` and `defaultDealId` props for Phase 6 pre-fill
- [ ] Submitting create sends POST to `/api/tasks`, success shows toast and closes dialog
- [ ] Submitting edit sends PATCH to `/api/tasks/[id]`, success shows toast and closes dialog
- [ ] On error, dialog stays open and toast shows error message
- [ ] Tasks list page "Add Task" button opens TaskFormDialog in create mode
- [ ] Tasks list row dropdown has "Edit" option that fetches full task then opens TaskFormDialog in edit mode
- [ ] React Query invalidation: both mutations invalidate `["tasks"]` (already handled in existing hooks)
- [ ] `npm run build` passes

## must_haves
- Single `TaskFormDialog` component at `src/components/tasks/task-form-dialog.tsx` used for both create and edit
- Exposes ALL fields listed in TASK-03: title, description, status, priority, dueDate, assigneeId (UserPicker), contactId (ContactPicker), dealId (DealPicker)
- Status field hidden in create mode, visible in edit mode
- Pre-fills all current task values in edit mode (TASK-04)
- Accepts `defaultContactId` and `defaultDealId` props for contextual create (needed by Phase 6)
- `GET /api/tasks/[id]` endpoint exists and returns single task (TASK-05)
- Uses existing PATCH API at `/api/tasks/[id]` for updates
- Uses existing POST API at `/api/tasks` for creation
- Edit option added to tasks list row dropdown
- Inline create dialog in tasks page replaced with TaskFormDialog
- Dialog stays open on validation/submission error

## PLANNING COMPLETE
