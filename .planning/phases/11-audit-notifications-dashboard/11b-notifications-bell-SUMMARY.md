# Phase 11b: Notification Bell + Dropdown - Summary

**Status:** Complete
**Completed:** 2026-03-05

---

## What Was Built

### 1. NotificationBell Component (`src/components/layout/notification-bell.tsx`)
- Client component using Popover (not DropdownMenu) for rich layout control
- **Badge:** Red unread count badge on bell icon, shows "99+" for overflow
- **Dropdown header:** "Notifications" title + "Mark all read" button (only when unread exist)
- **Alert list:** Up to 5 most recent alerts with severity-colored icons (critical=red AlertTriangle, warning=yellow TrendingDown, info=blue Bell), truncated title/message, relative timestamp via date-fns
- **Unread indicators:** Blue dot next to title + subtle background tint for unread items
- **Mark read:** Clicking an unread alert marks it read inline via PATCH /api/alerts
- **Mark all read:** Header button marks all unread alerts read in one call
- **Empty state:** Bell icon + "No notifications" message when no alerts exist
- **Footer:** "View all alerts" link navigating to /alerts, closes popover on click
- **Cache invalidation:** Both mutations invalidate ["alerts"] and ["dashboard"] query keys

### 2. TopNav Integration (`src/components/layout/top-nav.tsx`)
- Replaced static, non-functional `<Button>` with `<Bell>` icon with the new `<NotificationBell />` component
- Removed unused `Bell` import from lucide-react
- No other changes to TopNav structure

---

## Requirements Covered

| Requirement | Description | Status |
|-------------|-------------|--------|
| NOTF-01 | Bell icon in top nav shows unread alert count | Done |
| NOTF-02 | Clicking bell opens dropdown with recent alerts | Done |
| NOTF-03 | Dropdown links to full alerts page | Done |

---

## Files Changed

| File | Action |
|------|--------|
| `src/components/layout/notification-bell.tsx` | Created |
| `src/components/layout/top-nav.tsx` | Modified |

---

## Design Decisions

- **Popover over DropdownMenu:** Rich content layout (header, scrollable list, footer) needs full control, not a simple menu
- **Show 5 most recent (not just unread):** Avoids empty dropdown when all are read; unread items are visually distinguished
- **Reuse useAlerts() hook:** Leverages existing React Query cache, no extra network requests if dashboard already fetched
- **Mark-read on click (no navigation):** Quick triage pattern; full alerts page is for detailed management
- **No polling added:** Dashboard already polls every 30s and invalidates related queries; real-time deferred to v2
