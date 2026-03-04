---
phase: 1
plan: "01-users-api"
title: "Users Data Access Layer & API Routes"
wave: 1
depends_on: []
files_modified:
  - src/lib/api/users.ts
  - src/lib/validators/user.ts
  - src/app/api/users/route.ts
  - src/app/api/users/[id]/route.ts
  - src/lib/hooks/use-users.ts
autonomous: true
requirements:
  - USER-01
  - USER-02
  - USER-03
---

# Users Data Access Layer & API Routes

## Objective
Create the server-side data access layer, Zod validators, API route handlers, and React Query hooks for listing, updating roles, and toggling active status of CRM users.

<tasks>

<task id="1">
Create Zod validators at `src/lib/validators/user.ts`.

Define:
- `updateUserRoleSchema` — `z.object({ role: z.enum(["admin", "manager", "account_manager", "ae", "enterprise_sales"]) })`
- `updateUserStatusSchema` — `z.object({ isActive: z.boolean() })`
- `updateUserSchema` — Union/merge of both: `z.object({ role: z.enum([...]).optional(), isActive: z.boolean().optional() })` for the PATCH handler.

Export the inferred types `UpdateUserRoleInput`, `UpdateUserStatusInput`, and `UpdateUserInput`.

Follow the pattern in `src/lib/validators/contact.ts` (Zod schema + exported type).
</task>

<task id="2">
Create the data access layer at `src/lib/api/users.ts`.

Follow the exact pattern from `src/lib/api/contacts.ts`:

- `listUsers()` — Select all columns from `users` table (`id`, `clerkId`, `email`, `firstName`, `lastName`, `avatarUrl`, `role`, `isActive`, `createdAt`, `updatedAt`). Order by `firstName` asc. No pagination needed (internal team, small dataset). Return the full array.

- `getUser(id: string)` — Select a single user by `users.id`. Return `null` if not found.

- `updateUser(id: string, data: UpdateUserInput)` — Update user row: set provided fields plus `updatedAt: new Date()`. Use `.where(eq(users.id, id)).returning()`. Return the updated user.

Import `db` from `@/lib/db`, `users` from `@/lib/db/schema`, `eq` from `drizzle-orm`.
</task>

<task id="3">
Create `src/app/api/users/route.ts` with a `GET` handler.

Follow the pattern from `src/app/api/contacts/route.ts`:
- Call `requireUser()` for auth.
- Call `listUsers()` from the data access layer.
- Return `NextResponse.json(users)`.
- Handle "Unauthorized" error with 401, other errors with 500.
- No query params needed for this endpoint.
</task>

<task id="4">
Create `src/app/api/users/[id]/route.ts` with a `PATCH` handler.

Follow the pattern from `src/app/api/contacts/[id]/route.ts`:
- Call `requireRole(["admin"])` from `@/lib/auth/helpers` — only admins can update users.
- Parse body with `updateUserSchema.safeParse(body)`. Return 400 on validation failure with `parsed.error.flatten()`.
- Call `updateUser(id, parsed.data)`.
- If no user returned, return 404 `{ error: "User not found" }`.
- Return the updated user as JSON.
- Handle "Unauthorized" → 401, "Forbidden" → 403, other → 500.

The route file receives `params` from the second argument: `{ params }: { params: Promise<{ id: string }> }` (Next.js 16 async params pattern — verify by checking `src/app/api/contacts/[id]/route.ts` for the exact pattern used).
</task>

<task id="5">
Create React Query hooks at `src/lib/hooks/use-users.ts`.

Follow the exact pattern from `src/lib/hooks/use-contacts.ts`:

- `useUsers()` — `useQuery({ queryKey: ["users"], queryFn })` that fetches `GET /api/users`.

- `useUpdateUser()` — `useMutation` that sends `PATCH /api/users/[id]` with `{ role?, isActive? }` body. On success, invalidate `queryKey: ["users"]`. Mutation function signature: `({ id, data }: { id: string; data: { role?: string; isActive?: boolean } })`.

All hooks must be marked `"use client"` at top of file.
</task>

</tasks>

## Verification
- [ ] `GET /api/users` returns a JSON array of all users with id, email, firstName, lastName, avatarUrl, role, isActive fields
- [ ] `PATCH /api/users/[id]` with `{ "role": "manager" }` updates the user's role and returns the updated record
- [ ] `PATCH /api/users/[id]` with `{ "isActive": false }` deactivates the user
- [ ] `PATCH /api/users/[id]` returns 403 when called by a non-admin user
- [ ] `PATCH /api/users/[id]` returns 400 when given an invalid role value
- [ ] `useUsers()` hook returns data from the API
- [ ] `useUpdateUser()` hook invalidates the users query on success

## must_haves
- API enforces admin-only access for role and status changes
- Data access layer returns all fields needed for the team table (avatar, name, email, role, isActive)
- React Query hooks follow existing project conventions for cache invalidation
