# Summary: 01-users-api — Users Data Access Layer & API Routes

## What Was Built

Server-side data access layer, Zod validators, API route handlers, and React Query hooks for listing, updating roles, and toggling active status of CRM users.

## Key Files Created

| File | Purpose |
|------|---------|
| `src/lib/validators/user.ts` | Zod schemas: `updateUserRoleSchema`, `updateUserStatusSchema`, `updateUserSchema` with exported types |
| `src/lib/api/users.ts` | Data access layer: `listUsers()`, `getUser()`, `updateUser()` |
| `src/app/api/users/route.ts` | `GET /api/users` — returns all users, requires auth |
| `src/app/api/users/[id]/route.ts` | `PATCH /api/users/[id]` — updates role/status, admin-only |
| `src/lib/hooks/use-users.ts` | React Query hooks: `useUsers()`, `useUpdateUser()` |

## Deviations from Plan

None. All 5 tasks were implemented exactly as specified, following existing codebase patterns from contacts.

## Patterns Followed

- **Validators:** Same Zod schema + exported type pattern as `contact.ts`
- **Data access:** Same import style (`db`, schema, `eq`/`asc` from drizzle-orm) as `contacts.ts`
- **API routes:** Same error handling pattern (Unauthorized -> 401, Forbidden -> 403, other -> 500) as contacts routes
- **Dynamic route params:** Used Next.js 16 async params pattern (`params: Promise<{ id: string }>`)
- **React Query hooks:** Same `"use client"` directive, `useQuery`/`useMutation` pattern, cache invalidation as `use-contacts.ts`
- **Admin-only enforcement:** Used `requireRole(["admin"])` from `@/lib/auth/helpers`

## Self-Check

- [x] `src/lib/validators/user.ts` exists with 3 schemas and 3 exported types
- [x] `src/lib/api/users.ts` exists with `listUsers`, `getUser`, `updateUser`
- [x] `src/app/api/users/route.ts` exists with GET handler
- [x] `src/app/api/users/[id]/route.ts` exists with PATCH handler (admin-only)
- [x] `src/lib/hooks/use-users.ts` exists with `useUsers`, `useUpdateUser`
- [x] All 5 tasks committed atomically
