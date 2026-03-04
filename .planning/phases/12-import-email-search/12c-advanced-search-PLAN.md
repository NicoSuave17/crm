# Phase 12c: Advanced Search (Command Palette)

**Requirements:** SRCH-01, SRCH-02, SRCH-03
**Scope:** Expand the Cmd+K command palette to search all entity types, show recent items, and offer quick-create actions.
**Wave:** 2 (independent of 12a and 12b, but naturally last since it is a UX enhancement)
**Depends on:** None (command palette and search API already exist)

---

## Current State Assessment

### What exists:
- **Command palette** (`src/components/layout/command-palette.tsx`) -- Opens on Cmd+K. Searches contacts and deals via `/api/search`. Shows navigation links (Dashboard, Contacts, Pipeline, Tasks, Settings) when query is short. Uses shadcn CommandDialog.
- **Search API** (`src/app/api/search/route.ts`) -- Searches contacts (by firstName, lastName, email, whopUsername) and deals (by title). Returns max 5 of each. Does NOT search companies, tasks, or settings pages.
- **Entity pages that exist:** Contacts, Deals, Companies, Tasks, Settings (with sub-tabs: Team, Tags, Custom Fields, Pipelines, Audit Log, and soon Email Templates)

### What needs to be built:
1. **Expand search API** to include companies and tasks (SRCH-01)
2. **Add settings page results** to command palette navigation (SRCH-01)
3. **Add recent items** tracking and display (SRCH-02)
4. **Add quick actions** for creating entities (SRCH-03)
5. **Update command palette UI** to accommodate new result groups and sections

---

## Implementation Steps

### Step 1: Expand search API to include companies and tasks
**File:** `src/app/api/search/route.ts` (edit)

Current state: searches `contacts` and `deals` tables only.

Add parallel queries for `companies` and `tasks`:

```ts
import { contacts, deals, companies, tasks } from "@/lib/db/schema";

// Add to existing Promise.all:
const [contactResults, dealResults, companyResults, taskResults] = await Promise.all([
  // ... existing contact query ...
  // ... existing deal query ...
  db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
    })
    .from(companies)
    .where(
      or(
        ilike(companies.name, pattern),
        ilike(companies.domain, pattern)
      )
    )
    .limit(5),
  db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
    })
    .from(tasks)
    .where(ilike(tasks.title, pattern))
    .limit(5),
]);

return NextResponse.json({
  contacts: contactResults,
  deals: dealResults,
  companies: companyResults,
  tasks: taskResults,
});
```

### Step 2: Update SearchResult type in command palette
**File:** `src/components/layout/command-palette.tsx` (edit)

Update the `SearchResult` interface:

```ts
interface SearchResult {
  contacts: { id: string; firstName: string; lastName: string | null; email: string | null; type: string }[];
  deals: { id: string; title: string }[];
  companies: { id: string; name: string; domain: string | null }[];
  tasks: { id: string; title: string; status: string }[];
}
```

Update the initial state:

```ts
const [results, setResults] = useState<SearchResult>({
  contacts: [],
  deals: [],
  companies: [],
  tasks: [],
});
```

### Step 3: Add recent items tracking
**File:** `src/lib/utils/recent-items.ts` (new)

Recent items are stored in localStorage. No database table needed -- this is a per-browser, per-user convenience feature.

```ts
export interface RecentItem {
  id: string;
  type: "contact" | "deal" | "company" | "task";
  label: string;
  sublabel?: string;
  path: string;
  timestamp: number;
}

const STORAGE_KEY = "whop-crm-recent-items";
const MAX_RECENTS = 10;

export function getRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const items = JSON.parse(stored) as RecentItem[];
    // Filter out stale items (older than 30 days)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return items.filter((item) => item.timestamp > cutoff);
  } catch {
    return [];
  }
}

export function addRecentItem(item: Omit<RecentItem, "timestamp">) {
  const items = getRecentItems();
  // Remove existing entry for same id+type (dedup)
  const filtered = items.filter(
    (i) => !(i.id === item.id && i.type === item.type)
  );
  // Prepend new item
  filtered.unshift({ ...item, timestamp: Date.now() });
  // Trim to max
  const trimmed = filtered.slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

export function clearRecentItems() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
```

**Design decisions:**
- **localStorage, not database** -- Recent items are a UX convenience, not business data. They do not need to sync across devices or survive browser data clears. localStorage is the simplest approach and avoids schema/API complexity.
- **Max 10 items** -- Keeps the list concise in the command palette. 10 is enough to cover the entities a user interacts with in a session.
- **30-day TTL** -- Stale items are filtered out on read. Prevents accumulating irrelevant items over time.
- **Dedup by id+type** -- Visiting the same contact twice updates the timestamp but does not add a duplicate.

### Step 4: Track recent items on entity detail page visits
**Files to update:**
- `src/app/(dashboard)/contacts/[id]/page.tsx`
- `src/app/(dashboard)/deals/[id]/page.tsx`
- `src/app/(dashboard)/companies/[id]/page.tsx`
- `src/app/(dashboard)/tasks/page.tsx` (tasks do not have a detail page, so track when a task is opened/viewed if applicable)

For each entity detail page, add a `useEffect` that fires when the entity data loads:

```tsx
import { addRecentItem } from "@/lib/utils/recent-items";

useEffect(() => {
  if (contact) {
    addRecentItem({
      id: contact.id,
      type: "contact",
      label: `${contact.firstName} ${contact.lastName ?? ""}`.trim(),
      sublabel: contact.email ?? undefined,
      path: `/contacts/${contact.id}`,
    });
  }
}, [contact?.id]); // Only run when the contact ID changes
```

Similar patterns for deals (`label: deal.title`, `path: /deals/${deal.id}`) and companies (`label: company.name`, `path: /companies/${company.id}`).

For tasks: since tasks don't have a dedicated detail page, skip tracking task recents. The command palette's search results will still show tasks -- they just won't appear in "recents". This avoids unnecessary complexity.

### Step 5: Update command palette with recents, company/task results, and quick actions
**File:** `src/components/layout/command-palette.tsx` (edit)

This is the main UI update. The command palette will have the following sections, shown based on query state:

**When query is empty or < 2 chars (idle state):**
1. **Quick Actions** group -- "Create Contact", "Create Deal", "Create Task", "Create Company"
2. **Recent** group -- Last 10 visited entities from localStorage
3. **Navigate** group -- Dashboard, Contacts, Pipeline, Tasks, Companies, Settings

**When query >= 2 chars (search state):**
1. **Contacts** group -- Search results from API
2. **Deals** group -- Search results from API
3. **Companies** group -- Search results from API (NEW)
4. **Tasks** group -- Search results from API (NEW)
5. **Settings** group -- Client-side filter of settings pages matching query (NEW)

**Updated component structure:**

```tsx
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({
    contacts: [], deals: [], companies: [], tasks: [],
  });
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const router = useRouter();

  // Load recents when dialog opens
  useEffect(() => {
    if (open) {
      setRecents(getRecentItems());
    }
  }, [open]);

  // ... existing Cmd+K listener ...
  // ... existing search debounce (updated to handle new result types) ...

  // Settings pages for client-side matching
  const settingsPages = [
    { label: "Settings: Team", path: "/settings?tab=team", keywords: ["team", "members", "users", "roles"] },
    { label: "Settings: Tags", path: "/settings?tab=tags", keywords: ["tags", "labels"] },
    { label: "Settings: Custom Fields", path: "/settings?tab=custom-fields", keywords: ["custom fields", "fields", "properties"] },
    { label: "Settings: Pipelines", path: "/settings?tab=pipelines", keywords: ["pipelines", "stages"] },
    { label: "Settings: Email Templates", path: "/settings?tab=email-templates", keywords: ["email", "templates"] },
    { label: "Settings: Audit Log", path: "/settings?tab=audit-log", keywords: ["audit", "log", "history"] },
  ];

  const matchingSettings = query.length >= 2
    ? settingsPages.filter((p) =>
        p.keywords.some((kw) => kw.includes(query.toLowerCase())) ||
        p.label.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // Quick action handlers
  function handleQuickAction(action: string) {
    setOpen(false);
    setQuery("");
    // Navigate to the entity list page with a create dialog trigger
    // Using URL search param ?create=true to signal the page to open the create dialog
    switch (action) {
      case "create-contact":
        router.push("/contacts?create=true");
        break;
      case "create-deal":
        router.push("/pipeline?create=true");
        break;
      case "create-task":
        router.push("/tasks?create=true");
        break;
      case "create-company":
        router.push("/companies?create=true");
        break;
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contacts, deals, companies, tasks..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results (when query >= 2 chars) */}
        {results.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {results.contacts.map((c) => (
              <CommandItem key={c.id} onSelect={() => navigate(`/contacts/${c.id}`)}>
                <Users className="mr-2 h-4 w-4" />
                {c.firstName} {c.lastName}
                {c.email && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.deals.length > 0 && (
          <CommandGroup heading="Deals">
            {results.deals.map((d) => (
              <CommandItem key={d.id} onSelect={() => navigate(`/deals/${d.id}`)}>
                <FolderKanban className="mr-2 h-4 w-4" />
                {d.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.companies.length > 0 && (
          <CommandGroup heading="Companies">
            {results.companies.map((c) => (
              <CommandItem key={c.id} onSelect={() => navigate(`/companies/${c.id}`)}>
                <Building2 className="mr-2 h-4 w-4" />
                {c.name}
                {c.domain && <span className="ml-2 text-xs text-muted-foreground">{c.domain}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => navigate(`/tasks`)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                {t.title}
                <Badge variant="outline" className="ml-2 text-[10px]">{t.status}</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchingSettings.length > 0 && (
          <CommandGroup heading="Settings">
            {matchingSettings.map((s) => (
              <CommandItem key={s.path} onSelect={() => navigate(s.path)}>
                <Settings className="mr-2 h-4 w-4" />
                {s.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Idle state (no active search) */}
        {query.length < 2 && (
          <>
            {/* Quick Actions */}
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => handleQuickAction("create-contact")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Contact
              </CommandItem>
              <CommandItem onSelect={() => handleQuickAction("create-deal")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Deal
              </CommandItem>
              <CommandItem onSelect={() => handleQuickAction("create-task")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </CommandItem>
              <CommandItem onSelect={() => handleQuickAction("create-company")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Company
              </CommandItem>
            </CommandGroup>

            {/* Recent Items */}
            {recents.length > 0 && (
              <CommandGroup heading="Recent">
                {recents.map((item) => (
                  <CommandItem key={`${item.type}-${item.id}`} onSelect={() => navigate(item.path)}>
                    {item.type === "contact" && <Users className="mr-2 h-4 w-4" />}
                    {item.type === "deal" && <FolderKanban className="mr-2 h-4 w-4" />}
                    {item.type === "company" && <Building2 className="mr-2 h-4 w-4" />}
                    {item.type === "task" && <CheckSquare className="mr-2 h-4 w-4" />}
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Navigation */}
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => navigate("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => navigate("/contacts")}>
                <Users className="mr-2 h-4 w-4" />
                Contacts
              </CommandItem>
              <CommandItem onSelect={() => navigate("/companies")}>
                <Building2 className="mr-2 h-4 w-4" />
                Companies
              </CommandItem>
              <CommandItem onSelect={() => navigate("/pipeline")}>
                <Kanban className="mr-2 h-4 w-4" />
                Pipeline
              </CommandItem>
              <CommandItem onSelect={() => navigate("/tasks")}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Tasks
              </CommandItem>
              <CommandItem onSelect={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

### Step 6: Handle ?create=true on entity list pages
**Files to update:**
- `src/app/(dashboard)/contacts/page.tsx` -- Already has `createOpen` state. Add `useEffect` to check URL params.
- `src/app/(dashboard)/pipeline/page.tsx` -- If it has a create deal flow, same pattern.
- `src/app/(dashboard)/tasks/page.tsx` -- Same pattern.
- `src/app/(dashboard)/companies/page.tsx` -- Same pattern.

For each page, add:

```tsx
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();

useEffect(() => {
  if (searchParams.get("create") === "true") {
    setCreateOpen(true);
    // Remove the query param so refreshing doesn't re-open
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    window.history.replaceState({}, "", url.toString());
  }
}, [searchParams]);
```

This ensures the quick action from the command palette opens the create dialog on the target page.

### Step 7: Handle ?tab= on settings page
**File:** `src/app/(dashboard)/settings/page.tsx` (edit)

Currently uses `defaultValue="team"` on the Tabs component. Change to controlled with URL param support:

```tsx
const searchParams = useSearchParams();
const initialTab = searchParams.get("tab") ?? "team";
const [activeTab, setActiveTab] = useState(initialTab);

// Update when searchParams change (from command palette navigation)
useEffect(() => {
  const tab = searchParams.get("tab");
  if (tab) setActiveTab(tab);
}, [searchParams]);

<Tabs value={activeTab} onValueChange={setActiveTab}>
```

This allows the command palette to navigate directly to a specific settings tab via `/settings?tab=audit-log`.

### Step 8: Add Companies to navigation group
**File:** `src/components/layout/command-palette.tsx`

The current navigation group does not include Companies. Add it (between Contacts and Pipeline in the list). Also import `Building2` from lucide-react.

This change is included in Step 5 above but called out explicitly since the existing command palette is missing the Companies link.

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| SRCH-01 | Command palette searches deals, companies, tasks, and settings pages | Steps 1-2, 5 (API expansion + UI groups for all entity types + settings) |
| SRCH-02 | Command palette shows recent items | Steps 3-4 (localStorage tracking + recent items group in palette) |
| SRCH-03 | Command palette offers quick actions: "Create contact", "Create deal", etc. | Steps 5-6 (quick actions group + ?create=true handler on list pages) |

---

## Risks & Decisions

### Search performance with 4 parallel queries
The search API now runs 4 parallel queries (contacts, deals, companies, tasks). Each query uses `ilike` with a pattern and `limit(5)`. On a PostgreSQL database with proper indexes, this should complete in <50ms total. The existing indexes on `contacts` cover firstName, lastName, email. For companies, `companies.name` does not have an explicit text search index, but `ilike` on a small internal CRM dataset (likely <10k companies) is fast enough without one. Same for tasks.title.

If performance becomes an issue later, options:
- Add GIN trigram indexes for fuzzy search
- Implement a single full-text search query using `tsvector`
- Use an external search service (Algolia, Typesense)

For now, 4 simple ilike queries is the right balance of simplicity and performance.

### Settings search -- client-side vs. server-side
Settings pages are searched client-side using a static keyword map. This is intentional:
- Settings pages are a fixed, known set of routes
- There is no database entity to search against
- Client-side matching is instant (no API call)
- New settings tabs just need to be added to the `settingsPages` array

### Quick actions -- URL param approach vs. global state
Quick actions like "Create Contact" use URL navigation with `?create=true` to trigger the create dialog on the target page. Alternative approaches considered:
- **Global state (Zustand/Context):** Would work but adds complexity. The command palette would need to set global state, and each list page would need to consume it. URL params are simpler, shareable, and bookmarkable.
- **Direct dialog from palette:** Would require the create form to be rendered inside the command palette or as a floating dialog. This breaks the current pattern where forms are page-specific (e.g., ContactForm on contacts page).
- **URL param approach chosen:** Simple, works with Next.js router, no global state needed, and the cleanup (`replaceState`) prevents re-triggering on refresh.

### Recent items -- localStorage limitations
- localStorage is per-origin, per-browser. Recents do not sync across browsers/devices. Acceptable for an internal tool.
- localStorage has a ~5MB limit. With MAX_RECENTS=10, the data is ~2KB. No risk of hitting limits.
- If localStorage is unavailable (private browsing, storage quota exceeded), recent tracking silently fails. The feature degrades gracefully -- the "Recent" section simply does not appear.

### Task search behavior
Tasks do not have a dedicated detail page (they are managed on the tasks list page). When a user selects a task from search results, they navigate to `/tasks`. The task is not auto-focused or highlighted. This is acceptable for v1. A future enhancement could scroll to or highlight the selected task.

### Settings tab deep linking
The settings page changes from `defaultValue="team"` (uncontrolled) to `value={activeTab}` (controlled) to support `?tab=` URL params. This is a behavioral change: previously, switching tabs within settings was ephemeral (lost on navigation). Now, the initial tab can be set via URL, but tab changes within the page do not update the URL (to avoid cluttering browser history). If URL persistence is desired later, `onValueChange` can push a URL update.

---

## Verification

After implementation:
1. `npm run build` passes with no errors
2. Press Cmd+K anywhere in the app
3. **Idle state:**
   - "Quick Actions" section shows: Create Contact, Create Deal, Create Task, Create Company
   - "Navigate" section shows all pages including Companies
   - If entities were recently visited, "Recent" section shows them
4. **Quick actions:**
   - Select "Create Contact" -> navigates to /contacts, create dialog opens
   - Select "Create Deal" -> navigates to /pipeline, create dialog opens
   - Same for tasks and companies
   - `?create=true` param is cleaned from URL after dialog opens
5. **Search (type 2+ chars):**
   - Contacts results appear (existing behavior)
   - Deals results appear (existing behavior)
   - Companies results appear (NEW) with name + domain
   - Tasks results appear (NEW) with title + status badge
   - Settings pages appear (NEW) when query matches keywords (e.g., "audit" shows "Settings: Audit Log")
6. **Recent items:**
   - Visit a contact detail page, then open Cmd+K -> that contact appears in "Recent"
   - Visit a deal detail page -> deal appears in recent
   - Visit a company detail page -> company appears in recent
   - Recents are ordered by most recent visit
   - Max 10 recents shown
   - Recents persist across page navigations (localStorage)
7. **Settings deep links:**
   - From command palette, search "email" -> "Settings: Email Templates" appears
   - Select it -> navigates to settings page with Email Templates tab active
8. No console errors throughout
