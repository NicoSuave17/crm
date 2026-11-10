export interface DefaultNavItem {
  label: string;
  icon: string;
  href: string;
  section: "main" | "bottom";
  position: number;
  entityType: string | null;
}

export const DEFAULT_NAV_ITEMS: DefaultNavItem[] = [
  { label: "Dashboard", icon: "LayoutDashboard", href: "/dashboard", section: "main", position: 0, entityType: null },
  { label: "Contacts", icon: "Users", href: "/contacts", section: "main", position: 1, entityType: "contact" },
  { label: "Companies", icon: "Building2", href: "/companies", section: "main", position: 2, entityType: "company" },
  { label: "Pipeline", icon: "Kanban", href: "/pipeline", section: "main", position: 3, entityType: null },
  { label: "Deals", icon: "FolderKanban", href: "/deals", section: "main", position: 4, entityType: "deal" },
  { label: "Portfolio", icon: "Briefcase", href: "/portfolio", section: "main", position: 5, entityType: null },
  { label: "Tasks", icon: "CheckSquare", href: "/tasks", section: "main", position: 6, entityType: "task" },
  { label: "Alerts", icon: "Bell", href: "/alerts", section: "main", position: 7, entityType: null },
  { label: "Analytics", icon: "BarChart3", href: "/analytics", section: "main", position: 8, entityType: null },
  { label: "Reports", icon: "FileText", href: "/reports", section: "main", position: 9, entityType: null },
  { label: "Review Queue", icon: "Shield", href: "/review", section: "main", position: 10, entityType: null },
  { label: "Settings", icon: "Settings", href: "/settings", section: "bottom", position: 0, entityType: null },
  { label: "Admin", icon: "Shield", href: "/admin", section: "bottom", position: 1, entityType: null },
];
