# Phase 11b: Notification Bell + Dropdown

**Requirements:** NOTF-01, NOTF-02, NOTF-03
**Scope:** Add a notification bell icon with unread count badge in the top nav, a dropdown showing recent alerts, and a link to the full alerts page.
**Wave:** 1 (no dependencies on 11a or 11c)
**Depends on:** None (alerts DAL, API, hook, and full alerts page all exist)

---

## Current State Assessment

### What exists:
- **Top nav** (`src/components/layout/top-nav.tsx`) -- Has a Bell icon button, but it is a static, non-functional button with no badge, no dropdown, and no click behavior.
- **Alerts API** (`src/app/api/alerts/route.ts`) -- GET (list with optional `unreadOnly` param), PATCH (mark single read or mark all read).
- **Alerts DAL** (`src/lib/api/alerts.ts`) -- `listAlerts()`, `markAlertRead()`, `markAllAlertsRead()`, `dismissAlert()`, `createAlert()`.
- **Alerts hook** (`src/lib/hooks/use-dashboard.ts`) -- `useAlerts(unreadOnly?: boolean)` query hook. Returns array of alert objects with `id`, `type`, `title`, `message`, `severity`, `isRead`, `contactFirstName`, `contactLastName`, `contactId`, `createdAt`.
- **Dashboard API** (`src/app/api/dashboard/route.ts`) -- Returns `unreadAlerts` count as part of KPI response. Could be used for the badge count, but making a separate alerts call with `unreadOnly=true` is more direct.
- **Alerts page** (`src/app/(dashboard)/alerts/page.tsx`) -- Full alerts page with filter, mark-read, mark-all-read functionality. This is the page the dropdown should link to.
- **Dashboard layout** (`src/app/(dashboard)/layout.tsx`) -- Renders `<TopNav>` which contains the bell icon.

### What needs to be built:
1. A `NotificationBell` client component with unread count badge + Popover dropdown
2. Replace the static Bell button in `top-nav.tsx` with the new `NotificationBell` component
3. The dropdown shows the 5 most recent unread alerts with severity icon, title, message, and relative timestamp
4. "Mark all read" button in the dropdown header
5. "View all alerts" link at the bottom of the dropdown that navigates to `/alerts`
6. Clicking an individual alert marks it as read

---

## Implementation Steps

### Step 1: Create NotificationBell component
**File:** `src/components/layout/notification-bell.tsx` (new)

This component encapsulates all notification bell behavior: fetching unread alerts, displaying the count badge, rendering the dropdown, and handling mark-read mutations.

```tsx
"use client";

import { useState } from "react";
import { Bell, AlertTriangle, TrendingDown, Clock, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAlerts } from "@/lib/hooks/use-dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

type Alert = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactId: string | null;
  createdAt: string;
};

const severityColors: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: TrendingDown,
  info: Bell,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: alerts } = useAlerts();
  const queryClient = useQueryClient();

  const unreadAlerts = (alerts ?? []).filter((a: Alert) => !a.isRead);
  const unreadCount = unreadAlerts.length;
  const recentAlerts = (alerts ?? []).slice(0, 5) as Alert[];

  const markRead = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) throw new Error("Failed to mark alert read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) throw new Error("Failed to mark all alerts read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* Alert list */}
        <div className="max-h-[320px] overflow-y-auto">
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">No notifications</p>
            </div>
          ) : (
            recentAlerts.map((alert) => {
              const Icon = severityIcons[alert.severity] ?? Bell;
              return (
                <button
                  key={alert.id}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 ${
                    !alert.isRead ? "bg-primary/[0.03]" : ""
                  }`}
                  onClick={() => {
                    if (!alert.isRead) markRead.mutate(alert.id);
                  }}
                >
                  <Icon
                    className={`h-4 w-4 mt-0.5 shrink-0 ${severityColors[alert.severity] ?? ""}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      {!alert.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(alert.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Link
            href="/alerts"
            className="text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all alerts
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Key design decisions in this component:**
- Uses `Popover` (not `DropdownMenu`) because the content is a complex layout with scrolling, header, and footer -- not a simple menu.
- Shows the 5 most recent alerts regardless of read status (so the dropdown is not empty when all are read). Unread alerts get a blue dot indicator and subtle background highlight.
- Clicking an unread alert marks it as read inline (no navigation). The full alerts page is for detailed management.
- Badge shows `99+` if count exceeds 99 to prevent layout overflow.
- Max height of 320px with overflow scroll to prevent the dropdown from growing unbounded.

### Step 2: Replace static Bell button in TopNav
**File:** `src/components/layout/top-nav.tsx` (edit)

**Remove** the static Bell button and the `Bell` import from lucide-react.

**Add** import for the new component:
```ts
import { NotificationBell } from "@/components/layout/notification-bell";
```

**Replace the Notifications section:**

Before:
```tsx
{/* Notifications */}
<Button variant="ghost" size="icon" className="relative">
  <Bell className="h-4 w-4" />
</Button>
```

After:
```tsx
{/* Notifications */}
<NotificationBell />
```

**Updated imports for top-nav.tsx:**
```ts
import { Search, Menu } from "lucide-react";
```
Remove `Bell` from the lucide-react import since it is no longer used directly in this file.

Also remove `Button` import if it is no longer used in the file. However, `Button` is still used for the mobile menu toggle, so keep it.

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| NOTF-01 | Bell icon in top nav shows unread alert count | Step 1 (badge with unread count on bell icon), Step 2 (replace static bell in top-nav) |
| NOTF-02 | Clicking bell opens dropdown with recent alerts | Step 1 (Popover with recent alerts list showing severity icon, title, message, timestamp) |
| NOTF-03 | Dropdown links to full alerts page | Step 1 ("View all alerts" link in dropdown footer navigating to `/alerts`) |

---

## Risks & Decisions

### Popover vs. DropdownMenu
**Decision: Popover.** The notification dropdown is a rich content panel (header with action, scrollable list, footer with link), not a simple action menu. Popover from shadcn/ui gives us full layout control while still handling positioning, focus management, and click-outside-to-close.

### Fetching strategy for badge count
**Decision: Reuse existing `useAlerts()` hook.** The hook already fetches all alerts (up to 50) and is used on the dashboard page. The `useAlerts` data is cached by React Query, so rendering the `NotificationBell` does not cause extra network requests if the dashboard has already fetched alerts. The unread count is derived client-side by filtering `isRead === false`.

An alternative would be to use the dashboard KPI's `unreadAlerts` count (from `/api/dashboard`), but that would mean the bell count and dropdown list come from different queries and could be temporarily inconsistent.

### Show all 5 most recent vs. only unread
**Decision: Show the 5 most recent regardless of read status.** If we only showed unread alerts, the dropdown would be empty when all are read, giving no indication of recent activity. Showing recent alerts (with unread ones highlighted) is more informative. The full alerts page is linked for complete management.

### Mark-read on click vs. mark-read on navigation
**Decision: Mark-read on click.** Clicking an alert in the dropdown marks it as read immediately. This is the most intuitive behavior -- the user acknowledged the notification by clicking it. There is no navigation from the dropdown (unlike the full alerts page where individual alerts could link to contacts). The dropdown is purely for quick triage.

### NotificationBell as a client component in TopNav
`TopNav` is already a client component (`"use client"` directive). `NotificationBell` is also a client component because it uses hooks and state. No server/client boundary issues.

### Polling / real-time updates
The `useAlerts` hook does not currently poll. The `useDashboard` hook polls every 30s. For the bell to update in near-real-time, we could add `refetchInterval: 30000` to `useAlerts`. However, since both hooks share the React Query cache and the user is likely to navigate to dashboard frequently (triggering dashboard polling which invalidates related queries), the badge stays reasonably fresh. Real-time (WebSocket) updates are explicitly deferred to v2 in the requirements. If users want faster updates, we can add polling to `useAlerts` in a future iteration.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Top nav shows the bell icon in the same position as before
3. If there are unread alerts, a red badge with the count appears on the bell icon
4. If there are no unread alerts, no badge appears (just the bare bell icon)
5. Click the bell -- a popover dropdown opens aligned to the right
6. Dropdown header shows "Notifications" title and "Mark all read" button (if unread exist)
7. Dropdown body shows up to 5 recent alerts with severity icon, title (truncated), message (truncated), and relative timestamp
8. Unread alerts have a small blue dot next to the title and a subtle background tint
9. Click an unread alert -- it is marked as read (dot disappears, background normalizes)
10. Click "Mark all read" -- all unread indicators clear, badge disappears from bell
11. Dropdown footer shows "View all alerts" link
12. Click "View all alerts" -- navigates to `/alerts` page, dropdown closes
13. If no alerts exist at all, dropdown shows empty state with bell icon and "No notifications" message
14. No console errors throughout all interactions
