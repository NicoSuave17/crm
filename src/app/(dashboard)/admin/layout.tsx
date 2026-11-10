"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Navigation,
  Eye,
  Shield,
  Columns3,
  Users,
  FileText,
  UsersRound,
  Upload,
} from "lucide-react";

const adminSections = [
  { name: "Navigation", href: "/admin/navigation", icon: Navigation },
  { name: "Views", href: "/admin/views", icon: Eye },
  { name: "Permissions", href: "/admin/permissions", icon: Shield },
  { name: "Fields", href: "/admin/fields", icon: Columns3 },
  { name: "Roles", href: "/admin/roles", icon: Users },
  { name: "Teams", href: "/admin/teams", icon: UsersRound },
  { name: "Reports", href: "/admin/reports", icon: FileText },
  { name: "Imports", href: "/admin/imports", icon: Upload },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <h2 className="text-lg font-semibold mb-4">Admin</h2>
        <nav className="flex flex-col gap-1">
          {adminSections.map((section) => {
            const isActive =
              pathname === section.href ||
              pathname.startsWith(section.href + "/");
            return (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <section.icon className="h-4 w-4" />
                {section.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
