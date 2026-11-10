"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  FolderKanban,
  CheckSquare,
  Bell,
  BarChart3,
  Settings,
  Briefcase,
  ChevronLeft,
  Shield,
  FileText,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavItems, type NavItem } from "@/lib/hooks/use-nav";
import { DEFAULT_NAV_ITEMS } from "@/lib/constants/default-nav";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useGatekeeperStats } from "@/lib/hooks/use-review-queue";

// Icon registry maps string keys → Lucide components
const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  FolderKanban,
  CheckSquare,
  Bell,
  BarChart3,
  Settings,
  Briefcase,
  Shield,
  FileText,
  Circle,
};

// Fallback nav derived from shared default constant
const FALLBACK_NAV: NavItem[] = DEFAULT_NAV_ITEMS.map((item, i) => ({
  id: `fb-${i + 1}`,
  label: item.label,
  icon: item.icon,
  href: item.href,
  section: item.section,
  position: item.position,
  parentId: null,
  savedViewId: null,
  entityType: item.entityType,
  isSystem: true,
}));

function getIcon(iconKey: string): LucideIcon {
  return iconRegistry[iconKey] ?? Circle;
}

// Inline Whop brandmark SVG (official from brand kit)
function WhopLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 515"
      fill="none"
      className={className}
      aria-label="Whop"
    >
      <path
        d="M158.881 0C93.2 0 47.925 29 13.662 61.775C13.662 61.775-.173 74.965.002 75.367L143.897 220.129 287.766 75.367C260.521 37.631 209.152 0 158.881 0Z"
        fill="currentColor"
      />
      <path
        d="M514.191 0C448.513 0 403.236 29 368.971 61.775 368.971 61.775 356.336 74.613 355.763 75.367L177.903 254.322 321.574 398.857 643.077 75.367C615.831 37.631 564.488 0 514.191 0Z"
        fill="currentColor"
      />
      <path
        d="M870.479 0C804.798 0 759.524 29 725.259 61.775 725.259 61.775 712.098 74.714 711.6 75.367L355.806 433.351 393.466 471.237C451.73 529.852 547.101 529.852 605.365 471.237L998.914 75.367H999.365C972.119 37.631 920.773 0 870.479 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: navItems } = useNavItems();
  const { canRead, isAdminOrManager } = usePermissions();
  const { data: gkStats } = useGatekeeperStats();
  const reviewQueueCount = gkStats?.queueDepth ?? 0;

  const items = navItems && navItems.length > 0 ? navItems : FALLBACK_NAV;
  const filteredItems = items.filter((item) => {
    // Admin section: only admin/manager
    if (item.href.startsWith("/admin")) return isAdminOrManager;
    // Items with entity type: check read permission
    if (item.entityType) return canRead(item.entityType);
    // Everything else (dashboard, settings): always show
    return true;
  });
  const mainItems = filteredItems.filter((i) => i.section === "main");
  const bottomItems = filteredItems.filter((i) => i.section === "bottom");

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <WhopLogo className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-white tracking-tight">
              Whop CRM
            </span>
          </Link>
        )}
        {collapsed && (
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary mx-auto"
          >
            <WhopLogo className="h-5 w-5 text-white" />
          </Link>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {mainItems.map((item) => {
            const Icon = getIcon(item.icon);
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-sidebar-primary/10 text-white border-l-[3px] border-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white border-l-[3px] border-transparent",
                  collapsed && "justify-center px-2 border-l-0"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex items-center gap-2 flex-1">
                    {item.label}
                    {item.savedViewId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                    )}
                    {item.href === "/review" && reviewQueueCount > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                        {reviewQueueCount > 99 ? "99+" : reviewQueueCount}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2">
        {bottomItems.map((item) => {
          const Icon = getIcon(item.icon);
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary/10 text-white border-l-[3px] border-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white border-l-[3px] border-transparent",
                collapsed && "justify-center px-2 border-l-0"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "mt-1 w-full text-sidebar-foreground hover:bg-white/[0.06] hover:text-white",
            collapsed ? "justify-center px-2" : "justify-start"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
