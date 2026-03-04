# Phase 10a: Activity CRUD (Edit/Delete)

**Requirements:** ACTV-01, ACTV-02, ACTV-03
**Scope:** Add edit and delete capabilities to activity timeline items, with owner-only gating so users can only modify activities they created.
**Wave:** 1 (no dependencies outside existing codebase)
**Depends on:** None (activity creation, timeline, and activity-item components all exist)

---

## Current State Assessment

### What exists:
- **Activity timeline** (`src/components/activities/activity-timeline.tsx`) -- Renders `ActivityForm` for creation and maps activities to `ActivityItem` components. Used on contact detail, deal detail, and company detail pages.
- **Activity item** (`src/components/activities/activity-item.tsx`) -- Renders a single activity with icon, label, subject, body, duration, author avatar, and relative timestamp. No edit/delete controls.
- **Activity form** (`src/components/activities/activity-form.tsx`) -- Create-only form with type selector, subject, body, duration fields. Uses `useCreateActivity` mutation. Not designed for editing (no pre-fill, no edit mode).
- **Activities DAL** (`src/lib/api/activities.ts`) -- `listActivities()` and `createActivity()` functions. The `listActivities` query already selects `userId` from activities, so the current user's ownership can be checked on the client.
- **Activities API** (`src/app/api/activities/route.ts`) -- GET (list) and POST (create) handlers. No PATCH or DELETE. No `[id]` route segment exists.
- **Activity hooks** (`src/lib/hooks/use-activities.ts`) -- `useActivities()` query and `useCreateActivity()` mutation. No update/delete mutations.
- **Activity validator** (`src/lib/validators/activity.ts`) -- `createActivitySchema` with Zod. No update schema.
- **Auth helpers** (`src/lib/auth/helpers.ts`) -- `requireUser()` returns the current CRM user with `id` field, used for ownership checks.

### What needs to be built:
1. `updateActivity()` and `deleteActivity()` DAL functions with owner-only enforcement
2. `updateActivitySchema` Zod validator
3. `/api/activities/[id]` route with PATCH and DELETE handlers
4. `useUpdateActivity()` and `useDeleteActivity()` React Query hooks
5. Edit/delete UI controls on `ActivityItem` (visible only to the activity creator)
6. Edit mode for activity items (inline or dialog)

---

## Implementation Steps

### Step 1: Add update/delete to activities DAL
**File:** `src/lib/api/activities.ts` (edit)

Add two new functions after the existing `createActivity`:

**`updateActivity(id, userId, data)`:**
```ts
export async function updateActivity(
  id: string,
  userId: string,
  data: { type?: string; subject?: string | null; body?: string | null; duration?: number | null }
) {
  // Owner-only: WHERE id = ? AND userId = ?
  const [updated] = await db
    .update(activities)
    .set(data)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning();
  return updated; // undefined if not found or not owned
}
```

**`deleteActivity(id, userId)`:**
```ts
export async function deleteActivity(id: string, userId: string) {
  const result = await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning({ id: activities.id });
  return result.length > 0;
}
```

Both functions enforce ownership at the SQL level by including `userId` in the WHERE clause. If the activity does not exist or the current user is not the creator, no rows are affected and the function returns undefined/false.

**Imports to add:** `and` is already imported from drizzle-orm. No new imports needed.

### Step 2: Add update activity validator
**File:** `src/lib/validators/activity.ts` (edit)

Add `updateActivitySchema` after the existing `createActivitySchema`:

```ts
export const updateActivitySchema = z.object({
  type: z.enum([
    "note", "call", "email_sent", "email_received",
    "meeting", "linkedin_message",
  ]).optional(),
  subject: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
});

export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
```

Only user-editable fields are exposed. `contactId`, `dealId`, `companyId`, `userId`, `occurredAt` are not editable after creation -- these are structural fields that should not change.

### Step 3: Create `/api/activities/[id]` route
**File:** `src/app/api/activities/[id]/route.ts` (new)

This route handles PATCH (update) and DELETE for a single activity.

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { updateActivity, deleteActivity } from "@/lib/api/activities";
import { updateActivitySchema } from "@/lib/validators/activity";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const activity = await updateActivity(id, user.id, parsed.data);
    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found or you are not the owner" },
        { status: 404 }
      );
    }

    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/activities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const deleted = await deleteActivity(id, user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Activity not found or you are not the owner" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/activities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Owner-only gating:** The DAL functions enforce ownership. If the user is not the creator, the API returns 404 (not 403) to avoid leaking existence information. This is consistent with how the saved-views `[id]` route works.

### Step 4: Add update/delete hooks
**File:** `src/lib/hooks/use-activities.ts` (edit)

Add two new hooks after `useCreateActivity`:

**`useUpdateActivity()`:**
```ts
export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateActivityInput }) => {
      const res = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
```

**`useDeleteActivity()`:**
```ts
export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
```

**Import to add:** `UpdateActivityInput` from `@/lib/validators/activity`.

### Step 5: Add currentUserId to ActivityTimeline and pass to ActivityItem
**File:** `src/components/activities/activity-timeline.tsx` (edit)

The timeline needs to know the current user's CRM ID to determine which activities show edit/delete controls. Two approaches:

**Approach chosen:** Fetch the current user ID via the existing `useCurrentUser` hook (from `src/lib/hooks/use-users.ts`) inside ActivityTimeline. This avoids threading a prop through every parent that renders the timeline.

**Changes:**
1. Import `useCurrentUser` from `@/lib/hooks/use-users`.
2. Call `const { data: currentUser } = useCurrentUser();` at the top of the component.
3. Pass `currentUserId={currentUser?.id}` as a prop to each `ActivityItem`.
4. Expand the `activity` type inline annotation to include `userId: string | null` (already returned by the DAL but not typed in the timeline's map callback).

```tsx
// In the map callback:
<ActivityItem
  key={activity.id}
  activity={activity}
  currentUserId={currentUser?.id}
/>
```

### Step 6: Add edit/delete controls to ActivityItem
**File:** `src/components/activities/activity-item.tsx` (edit)

This is the main UI change. Each activity item gets a dropdown menu with "Edit" and "Delete" options, visible only when `currentUserId` matches `activity.userId`.

**Changes to props interface:**
```ts
interface ActivityItemProps {
  activity: {
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    userId: string | null;
    userFirstName: string | null;
    userLastName: string | null;
    userAvatarUrl: string | null;
    occurredAt: string;
    duration: number | null;
  };
  currentUserId?: string;
}
```

**Add state for edit mode:**
```ts
const [editing, setEditing] = useState(false);
const [editSubject, setEditSubject] = useState(activity.subject ?? "");
const [editBody, setEditBody] = useState(activity.body ?? "");
const [editType, setEditType] = useState(activity.type);
const [editDuration, setEditDuration] = useState(activity.duration?.toString() ?? "");
```

**Ownership check:**
```ts
const isOwner = currentUserId && activity.userId && currentUserId === activity.userId;
```

Only user-created activity types are editable: `note`, `call`, `email_sent`, `meeting`, `linkedin_message`. System-generated types (`deal_stage_change`, `health_score_change`, `churn_alert`, `gmv_milestone`, `system_event`, `task_completed`) are not editable.

```ts
const EDITABLE_TYPES = new Set(["note", "call", "email_sent", "meeting", "linkedin_message"]);
const canEdit = isOwner && EDITABLE_TYPES.has(activity.type);
```

**UI layout -- read mode:**

Add a `DropdownMenu` with a `MoreHorizontal` trigger button in the top-right of the activity item (next to the timestamp), visible only when `canEdit` is true.

```tsx
{canEdit && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setEditing(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

Add `group` class to the outer `div` of the activity item so hover reveals the menu.

**UI layout -- edit mode:**

When `editing` is true, replace the subject/body display with inline editing fields:

```tsx
{editing ? (
  <div className="space-y-2 mt-1">
    <Input
      value={editSubject}
      onChange={(e) => setEditSubject(e.target.value)}
      placeholder="Subject"
      className="h-8 text-sm"
    />
    <Textarea
      value={editBody}
      onChange={(e) => setEditBody(e.target.value)}
      placeholder="Details"
      rows={2}
      className="text-sm"
    />
    {(editType === "call" || editType === "meeting") && (
      <Input
        type="number"
        value={editDuration}
        onChange={(e) => setEditDuration(e.target.value)}
        placeholder="Duration (min)"
        className="h-8 text-sm w-36"
      />
    )}
    <div className="flex gap-2">
      <Button size="sm" variant="default" onClick={handleSave} disabled={updateActivity.isPending}>
        {updateActivity.isPending ? "Saving..." : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  </div>
) : (
  // existing subject/body display
)}
```

**Delete handler:**
```ts
const deleteActivity = useDeleteActivity();

function handleDelete() {
  if (!confirm("Delete this activity? This cannot be undone.")) return;
  deleteActivity.mutate(activity.id, {
    onSuccess: () => toast.success("Activity deleted"),
    onError: () => toast.error("Failed to delete activity"),
  });
}
```

**Save handler:**
```ts
const updateActivity = useUpdateActivity();

function handleSave() {
  updateActivity.mutate(
    {
      id: activity.id,
      data: {
        subject: editSubject || null,
        body: editBody || null,
        duration: editDuration ? parseInt(editDuration) : null,
      },
    },
    {
      onSuccess: () => {
        toast.success("Activity updated");
        setEditing(false);
      },
      onError: () => toast.error("Failed to update activity"),
    }
  );
}
```

**New imports needed:**
- `useState` from react
- `Button` from `@/components/ui/button`
- `Input` from `@/components/ui/input`
- `Textarea` from `@/components/ui/textarea`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from `@/components/ui/dropdown-menu`
- `MoreHorizontal`, `Pencil`, `Trash2` from `lucide-react`
- `useUpdateActivity`, `useDeleteActivity` from `@/lib/hooks/use-activities`
- `toast` from `sonner`

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| ACTV-01 | User can edit an activity they created (PATCH API + UI) | Steps 1-2 (DAL + validator), Step 3 (API), Step 4 (hooks), Step 6 (edit mode UI) |
| ACTV-02 | User can delete an activity they created (DELETE API + UI) | Step 1 (DAL), Step 3 (API), Step 4 (hooks), Step 6 (delete button UI) |
| ACTV-03 | Edit/delete buttons appear only on activities created by the current user | Steps 5-6 (`canEdit` check using `currentUserId === activity.userId`) |

---

## Risks & Decisions

### Inline editing vs. dialog
**Decision: Inline editing.** Activities are displayed in a timeline, and opening a dialog to edit a note feels heavyweight. Inline editing (replacing the text with input fields in place) is more natural for quick edits. The activity type is NOT editable after creation -- changing a "note" to a "call" would be confusing. Only subject, body, and duration are editable.

### System activity types are not editable
Activity types like `deal_stage_change`, `system_event`, etc. are system-generated. They should never show edit/delete controls regardless of userId. The `EDITABLE_TYPES` set ensures this. If a system event happens to have a userId (e.g., the user who triggered a deal stage change), the edit/delete controls still won't appear.

### Owner-only gating at API level vs. UI level
Both. The UI hides edit/delete controls for non-owners (ACTV-03). The API enforces ownership in the WHERE clause (defense in depth). If someone crafts a direct API request for an activity they don't own, they get a 404.

### Return 404 vs. 403 for non-owned activities
**Decision: 404.** Returning 403 would confirm the activity exists, which is an information leak. Returning 404 ("not found or not owned") is safer and simpler. This matches the pattern used by the saved-views `[id]` route.

### ActivityItem becoming a client component
`ActivityItem` is currently a server-compatible component (no "use client" directive, no hooks, no state). Adding edit/delete functionality requires `useState`, hooks, and event handlers, making it a client component. This is fine because its parent `ActivityTimeline` is already `"use client"`.

Add `"use client"` directive to the top of `activity-item.tsx`.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to a contact detail page with activities
3. Activities created by the current user show a three-dot menu on hover
4. Activities created by other users do NOT show the three-dot menu
5. System-generated activities (deal stage changes, etc.) never show the menu regardless of creator
6. Click "Edit" on an owned activity -- inline edit fields appear with pre-filled values
7. Modify the body text and click "Save" -- activity updates, toast confirms, edit mode closes
8. Click "Cancel" -- edit mode closes without changes
9. Click "Delete" on an owned activity -- confirmation prompt appears
10. Confirm delete -- activity removed from timeline, toast confirms
11. Repeat on deal detail page and company detail page to confirm timeline works everywhere
12. No console errors throughout all interactions
