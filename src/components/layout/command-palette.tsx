"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FolderKanban,
  LayoutDashboard,
  Kanban,
  CheckSquare,
  Settings,
  Building2,
  Plus,
  MessageSquare,
} from "lucide-react";
import { getRecentItems, type RecentItem } from "@/lib/utils/recent-items";

interface SearchResult {
  contacts: { id: string; firstName: string; lastName: string | null; email: string | null; type: string }[];
  deals: { id: string; title: string }[];
  companies: { id: string; name: string; domain: string | null }[];
  tasks: { id: string; title: string; status: string }[];
  activities: { id: string; type: string; subject: string | null; contactId: string | null; dealId: string | null }[];
}

const ENTITY_ICONS: Record<RecentItem["type"], typeof Users> = {
  contact: Users,
  deal: FolderKanban,
  company: Building2,
  task: CheckSquare,
};

const settingsPages = [
  { label: "Settings: Team", path: "/settings?tab=team", keywords: ["team", "members", "users", "roles"] },
  { label: "Settings: Tags", path: "/settings?tab=tags", keywords: ["tags", "labels"] },
  { label: "Settings: Custom Fields", path: "/settings?tab=custom-fields", keywords: ["custom fields", "fields", "properties"] },
  { label: "Settings: Pipelines", path: "/settings?tab=pipelines", keywords: ["pipelines", "stages"] },
  { label: "Settings: Email Templates", path: "/settings?tab=email-templates", keywords: ["email", "templates"] },
  { label: "Settings: Audit Log", path: "/settings?tab=audit-log", keywords: ["audit", "log", "history"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({
    contacts: [],
    deals: [],
    companies: [],
    tasks: [],
    activities: [],
  });
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const router = useRouter();

  // Load recents when dialog opens
  useEffect(() => {
    if (open) {
      setRecents(getRecentItems());
    }
  }, [open]);

  // Cmd+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Search debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults({ contacts: [], deals: [], companies: [], tasks: [], activities: [] });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch {
        // silently ignore search errors
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      router.push(path);
    },
    [router]
  );

  function handleQuickAction(action: string) {
    setOpen(false);
    setQuery("");
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

  // Client-side settings page matching
  const matchingSettings =
    query.length >= 2
      ? settingsPages.filter(
          (p) =>
            p.keywords.some((kw) => kw.includes(query.toLowerCase())) ||
            p.label.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  const isSearching = query.length >= 2;
  const hasResults =
    results.contacts.length > 0 ||
    results.deals.length > 0 ||
    results.companies.length > 0 ||
    results.tasks.length > 0 ||
    results.activities.length > 0 ||
    matchingSettings.length > 0;

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
              <CommandItem
                key={c.id}
                onSelect={() => navigate(`/contacts/${c.id}`)}
              >
                <Users className="mr-2 h-4 w-4" />
                {c.firstName} {c.lastName}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {c.type.replace("_", " ")}
                </Badge>
                {c.email && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.email}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.deals.length > 0 && (
          <CommandGroup heading="Deals">
            {results.deals.map((d) => (
              <CommandItem
                key={d.id}
                onSelect={() => navigate(`/deals/${d.id}`)}
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                {d.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.companies.length > 0 && (
          <CommandGroup heading="Companies">
            {results.companies.map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => navigate(`/companies/${c.id}`)}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {c.name}
                {c.domain && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.domain}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => navigate("/tasks")}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                {t.title}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {t.status.replace("_", " ")}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.activities.length > 0 && (
          <CommandGroup heading="Activities">
            {results.activities.map((a) => (
              <CommandItem
                key={a.id}
                onSelect={() => {
                  // Navigate to the related contact or deal
                  if (a.contactId) navigate(`/contacts/${a.contactId}`);
                  else if (a.dealId) navigate(`/deals/${a.dealId}`);
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {a.subject || `${a.type} activity`}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {a.type.replace("_", " ")}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchingSettings.length > 0 && (
          <CommandGroup heading="Settings">
            {matchingSettings.map((s) => (
              <CommandItem
                key={s.path}
                onSelect={() => navigate(s.path)}
              >
                <Settings className="mr-2 h-4 w-4" />
                {s.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Idle state (no active search) */}
        {!isSearching && (
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
                {recents.map((item) => {
                  const Icon = ENTITY_ICONS[item.type];
                  return (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      onSelect={() => navigate(item.path)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {item.type}
                      </Badge>
                      {item.sublabel && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.sublabel}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
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
