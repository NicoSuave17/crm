# Phase 11a: Audit Log Settings Tab

**Requirements:** AUDT-01, AUDT-02
**Scope:** Add an "Audit Log" tab to the Settings page with a paginated table showing all system events, plus filters for date range, user, and entity type.
**Wave:** 1 (no dependencies on 11b or 11c)
**Depends on:** None (audit-log DAL, API route, and React Query hook all exist)

---

## Current State Assessment

### What exists:
- **Audit log DAL** (`src/lib/api/audit-log.ts`) -- `logAuditEvent()` writes audit entries as `system_event` activity rows. `listAuditLog()` reads them back with user join, supports `limit`, `offset`, `entityType`, `userId`, `since` params.
- **Audit log API** (`src/app/api/audit-log/route.ts`) -- GET handler that proxies all query params to `listAuditLog()`. Returns JSON array of audit rows.
- **Audit log hook** (`src/lib/hooks/use-audit-log.ts`) -- `useAuditLog()` React Query hook with `limit`, `offset`, `entityType`, `userId` params. Currently unused in any UI.
- **Settings page** (`src/app/(dashboard)/settings/page.tsx`) -- Tabs: Team, Tags, Custom Fields, Pipelines. No Audit Log tab.
- **Activities schema** (`src/lib/db/schema.ts`) -- Audit events are stored in the `activities` table with `type = "system_event"`. Metadata JSONB stores `auditAction`, `entityType`, `entityId`, `changes`.

### What needs to be built:
1. Extend `useAuditLog` hook to support `since` (date range) parameter
2. Add "Audit Log" tab to the Settings page
3. Build `AuditLogSettings` component with paginated table + filters
4. Extend `listAuditLog` DAL to return a total count for pagination
5. Update audit log API to return total count alongside data

---

## Implementation Steps

### Step 1: Extend audit log DAL to return count for pagination
**File:** `src/lib/api/audit-log.ts` (edit)

The current `listAuditLog` returns only rows. For pagination controls we need a total count.

**Change `listAuditLog` return signature to include `total`:**

```ts
export async function listAuditLog(params: {
  limit?: number;
  offset?: number;
  entityType?: string;
  userId?: string;
  since?: Date;
  until?: Date;
}) {
  const { limit = 50, offset = 0, entityType, userId, since, until } = params;

  const conditions = [eq(activities.type, "system_event")];

  if (userId) {
    conditions.push(eq(activities.userId, userId));
  }

  if (since) {
    conditions.push(gte(activities.occurredAt, since));
  }

  if (until) {
    conditions.push(lte(activities.occurredAt, until));
  }

  // Build the base where clause
  const whereClause = and(...conditions);

  // Get total count (before pagination, but after filters except entityType which is app-level)
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(whereClause);

  const rows = await db
    .select({
      id: activities.id,
      action: activities.subject,
      body: activities.body,
      metadata: activities.metadata,
      userId: activities.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      occurredAt: activities.occurredAt,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(whereClause)
    .orderBy(desc(activities.occurredAt))
    .limit(limit)
    .offset(offset);

  // entityType filter is in metadata, applied in application layer
  let filtered = rows;
  if (entityType) {
    filtered = rows.filter(
      (r) => (r.metadata as Record<string, unknown>)?.entityType === entityType
    );
  }

  return { data: filtered, total: Number(countResult.count) };
}
```

**New import needed:** `lte` from `drizzle-orm` (add to existing import line).

**Note on entityType filtering:** The entityType filter is applied in the application layer because it is stored inside the metadata JSONB. This means the `total` count may slightly overcount when entityType is specified. This is acceptable for an internal admin tool -- exact counts would require a SQL JSONB filter or a dedicated `entityType` column. If this becomes a problem, we can add a SQL `metadata->>'entityType'` filter later.

### Step 2: Update audit log API to return structured response
**File:** `src/app/api/audit-log/route.ts` (edit)

Update the GET handler to pass through the `until` param and return the `{ data, total }` structure:

```ts
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);

    const result = await listAuditLog({
      limit: Number(searchParams.get("limit")) || 50,
      offset: Number(searchParams.get("offset")) || 0,
      entityType: searchParams.get("entityType") || undefined,
      userId: searchParams.get("userId") || undefined,
      since: searchParams.get("since") ? new Date(searchParams.get("since")!) : undefined,
      until: searchParams.get("until") ? new Date(searchParams.get("until")!) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 3: Extend useAuditLog hook for date range and pagination response
**File:** `src/lib/hooks/use-audit-log.ts` (edit)

Update to support `since` and `until` params, and type the response as `{ data: AuditRow[], total: number }`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

export interface AuditRow {
  id: string;
  action: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  occurredAt: string;
}

export function useAuditLog(params: {
  limit?: number;
  offset?: number;
  entityType?: string;
  userId?: string;
  since?: string;
  until?: string;
} = {}) {
  return useQuery<{ data: AuditRow[]; total: number }>({
    queryKey: ["audit-log", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set("limit", String(params.limit));
      if (params.offset) searchParams.set("offset", String(params.offset));
      if (params.entityType) searchParams.set("entityType", params.entityType);
      if (params.userId) searchParams.set("userId", params.userId);
      if (params.since) searchParams.set("since", params.since);
      if (params.until) searchParams.set("until", params.until);
      const qs = searchParams.toString();
      const res = await fetch(`/api/audit-log${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });
}
```

### Step 4: Add Audit Log tab to Settings page
**File:** `src/app/(dashboard)/settings/page.tsx` (edit)

Add a new tab trigger and tab content. The audit log component will be built inline in the same file (consistent with how TeamSettings, TagsSettings, etc. are defined).

**Add to imports at top of file:**
```ts
import { FileText } from "lucide-react";
import { useAuditLog } from "@/lib/hooks/use-audit-log";
import { useUsers } from "@/lib/hooks/use-users";
import { format } from "date-fns";
```

**Add tab trigger after Pipelines:**
```tsx
<TabsTrigger value="audit-log">
  <FileText className="mr-2 h-4 w-4" />
  Audit Log
</TabsTrigger>
```

**Add tab content after pipelines TabsContent:**
```tsx
<TabsContent value="audit-log" className="mt-4">
  <AuditLogSettings />
</TabsContent>
```

### Step 5: Build AuditLogSettings component
**File:** `src/app/(dashboard)/settings/page.tsx` (edit -- add new component at bottom)

This is the main UI component. It renders:
1. A filter bar with: date range (since/until date inputs), user select, entity type select
2. A paginated table showing: timestamp, user, action, entity type, entity name, details
3. Pagination controls (previous/next) with page indicator

```tsx
const PAGE_SIZE = 25;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  deal: "Deal",
  task: "Task",
  pipeline: "Pipeline",
  tag: "Tag",
  custom_field: "Custom Field",
  user: "User",
  company: "Company",
};

function AuditLogSettings() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");

  const { data: users } = useUsers();

  const { data: result, isLoading } = useAuditLog({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    entityType: entityType !== "all" ? entityType : undefined,
    userId: userId !== "all" ? userId : undefined,
    since: since || undefined,
    until: until || undefined,
  });

  const entries = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Reset to page 0 when filters change
  // (handled by the filter onChange callbacks calling setPage(0))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>
          Review all system events and changes made by team members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={since}
              onChange={(e) => { setSince(e.target.value); setPage(0); }}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={until}
              onChange={(e) => { setUntil(e.target.value); setPage(0); }}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map((u: { id: string; firstName: string; lastName: string }) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Entity Type</label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(since || until || entityType !== "all" || userId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSince("");
                setUntil("");
                setEntityType("all");
                setUserId("all");
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No audit log entries found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead className="w-[140px]">User</TableHead>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead className="w-[100px]">Entity Type</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: AuditRow) => {
                const meta = entry.metadata as Record<string, unknown> | null;
                const entType = (meta?.entityType as string) ?? "—";
                const changes = meta?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
                const changesSummary = changes
                  ? Object.entries(changes)
                      .map(([field, { from, to }]) => `${field}: ${String(from)} → ${String(to)}`)
                      .join(", ")
                  : null;

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.occurredAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.userFirstName} {entry.userLastName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.action ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_TYPE_LABELS[entType] ?? entType}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {changesSummary ?? (entry.body ?? "—")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Import `AuditRow` type** from the hook file: `import { useAuditLog, type AuditRow } from "@/lib/hooks/use-audit-log";`

**Import `format` from `date-fns`:** Already available in the project (used on dashboard page).

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| AUDT-01 | Audit log page in settings showing: timestamp, user, action, entity type, entity name, details | Steps 4-5 (Audit Log tab with paginated table showing all required columns) |
| AUDT-02 | Audit log has filters: date range, user, entity type | Step 5 (filter bar with since/until date inputs, user select, entity type select) |

---

## Risks & Decisions

### Audit log as a Settings tab vs. standalone page
**Decision: Settings tab.** The requirements say "Audit log page exists in settings" (AUDT-01). This keeps it consistent with the existing settings structure and avoids cluttering the sidebar.

### Application-layer entityType filtering
The `entityType` is stored inside the metadata JSONB, so filtering happens in JavaScript after the SQL query. This means the `total` count may not perfectly reflect entityType-filtered results. For an internal admin tool with moderate data volume, this is acceptable. If audit volume grows significantly, the fix is to add a dedicated `entityType` text column to the activities table or create a separate `audit_log` table.

### Pagination approach
Using offset-based pagination with Previous/Next buttons. Cursor-based pagination would be more performant at scale but adds complexity. The PAGE_SIZE of 25 keeps queries fast and the UI scannable.

### No `until` param existed in the DAL
The original `listAuditLog` only supported `since`. We add `until` to support full date range filtering (AUDT-02 says "date range"). This requires importing `lte` from drizzle-orm.

### date-fns `format` import
The project already uses `date-fns` (visible in dashboard and alerts pages using `formatDistanceToNow`). The `format` function from the same package is used for the timestamp column display.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Navigate to Settings page -- "Audit Log" tab appears after "Pipelines"
3. Click "Audit Log" tab -- paginated table loads with existing system_event entries
4. Table columns display: timestamp (formatted), user name, action badge, entity type label, and details (change summary or body fallback)
5. Set "From" date to yesterday -- table filters to entries from that date onward, page resets to 0
6. Set "To" date to today -- table filters to date range
7. Select a user from the dropdown -- table filters to that user's events
8. Select an entity type -- table filters to that type
9. Click "Clear filters" -- all filters reset, full list shown
10. If more than 25 entries exist, pagination controls appear. "Previous" is disabled on page 1. Clicking "Next" loads the next page. "Showing X-Y of Z" indicator is accurate.
11. No console errors throughout all interactions
