---
phase: 1
plan: "01-team-settings-page"
title: "Settings Team Tab with User Management UI"
wave: 2
depends_on:
  - "01-users-api"
files_modified:
  - src/app/(dashboard)/settings/page.tsx
autonomous: true
requirements:
  - USER-01
  - USER-02
  - USER-03
  - USER-04
---

# Settings Team Tab with User Management UI

## Objective
Add a "Team" tab to the existing Settings page that displays all CRM users in a table with inline role editing, activate/deactivate toggle, and a note about Clerk auto-provisioning.

<tasks>

<task id="1">
Add a new "Team" tab to the Settings page at `src/app/(dashboard)/settings/page.tsx`.

In the existing `<Tabs>` component (currently has "tags", "custom-fields", "pipelines"):
- Add a new `<TabsTrigger value="team">` with a `Users` icon from lucide-react (already imported) and label "Team".
- Position it as the FIRST tab (before Tags) since team management is a primary settings concern.
- Add a corresponding `<TabsContent value="team">` that renders a new `<TeamSettings />` component.
- Change `defaultValue` from `"tags"` to `"team"`.

Import `useUsers` and `useUpdateUser` from `@/lib/hooks/use-users` at the top of the file.
</task>

<task id="2">
Create the `TeamSettings` component inside `src/app/(dashboard)/settings/page.tsx` (following the pattern of `TagsSettings`, `CustomFieldsSettings`, and `PipelinesSettings` which are all defined in the same file).

The component must:
- Call `useUsers()` to get the team member list.
- Call `useUpdateUser()` for mutations.
- Render a `<Card>` with `<CardHeader>` containing:
  - Title: "Team Members"
  - Description: "Manage your CRM team. New users are automatically created when they sign in with Clerk for the first time." (This satisfies USER-04)
- Render a loading state using `<Skeleton>` elements (3 rows) when `isLoading` is true.
</task>

<task id="3">
Inside the `TeamSettings` component, render a `<Table>` (using the already-imported Table components) with these columns:

- **Member** — Avatar (using `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` from `@/components/ui/avatar`) showing user's `avatarUrl` with fallback of first initials, plus full name (`firstName + " " + lastName`) and email below in muted text.
- **Role** — For admin users viewing: a `<Select>` dropdown (inline, no dialog) with all five role options: Admin, Manager, Account Manager, AE, Enterprise Sales. Values: `admin`, `manager`, `account_manager`, `ae`, `enterprise_sales`. Display labels should be human-readable (e.g., "Account Manager" not "account_manager").
  - For non-admin users: a read-only `<Badge variant="outline">` showing the role.
- **Status** — A `<Badge>` showing "Active" (green/default variant) or "Inactive" (secondary/destructive variant) based on `isActive`.
- **Actions** — For admin users viewing another user's row: a `<Button variant="ghost" size="sm">` that toggles `isActive`. Label: "Deactivate" when active, "Activate" when inactive.
  - Do NOT show deactivate button for the current user's own row (admin cannot deactivate themselves).

Import `Avatar`, `AvatarImage`, `AvatarFallback` from `@/components/ui/avatar`.
</task>

<task id="4">
Implement role change handling in `TeamSettings`:

When an admin selects a new role from the inline `<Select>`:
- Call `updateUser.mutate({ id: user.id, data: { role: newRole } })`.
- On success callback: show `toast.success("Role updated")`.
- On error callback: show `toast.error("Failed to update role")`.

The Select's `onValueChange` handler triggers the mutation directly (no separate save button — inline editing pattern).
</task>

<task id="5">
Implement activate/deactivate handling in `TeamSettings`:

When an admin clicks the activate/deactivate button:
- Call `updateUser.mutate({ id: user.id, data: { isActive: !user.isActive } })`.
- On success: show `toast.success(user.isActive ? "User deactivated" : "User activated")`.
- On error: show `toast.error("Failed to update user status")`.

The button should be disabled while `updateUser.isPending` to prevent double-clicks.
</task>

<task id="6">
Determine the current user's role for conditional rendering.

The component needs to know if the current logged-in user is an admin to decide whether to show inline Select vs read-only Badge for roles, and whether to show the activate/deactivate action.

Approach: Add a separate API call or use a hook/context. The simplest approach matching existing patterns:
- Create a `useCurrentUser()` hook in `src/lib/hooks/use-users.ts` (in the same file created by the previous plan) that fetches `GET /api/users/me`.
- Add a `GET` handler to `src/app/api/users/[id]/route.ts` OR create a new `src/app/api/users/me/route.ts` that calls `requireUser()` and returns the current user object.
- In `TeamSettings`, call `useCurrentUser()` and check `currentUser.role === "admin"` to toggle between editable and read-only views.

Alternative: if a `/api/users/me` endpoint feels excessive, the component can match the current user from the `useUsers()` list by checking which user row matches. But this requires knowing the current user's ID. The cleanest approach is the `me` endpoint.

Create `src/app/api/users/me/route.ts`:
```
GET handler: call requireUser(), return NextResponse.json(user)
```

Add to `src/lib/hooks/use-users.ts`:
```
useCurrentUser() — useQuery({ queryKey: ["currentUser"], queryFn }) fetching GET /api/users/me
```

Note: this adds two files beyond the plan's `files_modified`. Update the files_modified list above if needed, or add them as part of this plan since they are tightly coupled.
</task>

<task id="7">
Handle the non-admin view:

When the current user is NOT an admin:
- The table still renders all team members (visibility is not restricted — they can see the team).
- Role column shows `<Badge variant="outline">` for ALL rows (no editable Select).
- Actions column is empty (no activate/deactivate buttons).
- This makes the table effectively read-only for non-admins, satisfying success criteria #4.
</task>

</tasks>

## Verification
- [ ] Settings page shows "Team" as the first (default) tab with a Users icon
- [ ] Team tab shows a table with all CRM users displaying avatar, name, email, role badge, and active/inactive status
- [ ] Card description mentions Clerk auto-provisioning (USER-04)
- [ ] Admin user sees inline Select dropdowns for role on all rows
- [ ] Changing a role via Select persists on page reload
- [ ] Admin user sees Deactivate/Activate button on other users' rows (not their own)
- [ ] Deactivating a user shows "Inactive" badge on that row
- [ ] Non-admin user sees all rows as read-only (no Select, no action buttons)
- [ ] Loading state shows skeleton placeholders
- [ ] Toast notifications appear for successful and failed operations

## must_haves
- Admin-only gating on role changes and status toggles (client-side rendering + server-side enforcement from API)
- Clerk auto-creation note visible in the Team tab header (USER-04)
- Current user cannot deactivate themselves
- Table shows avatar, full name, email, role, and status for each user
