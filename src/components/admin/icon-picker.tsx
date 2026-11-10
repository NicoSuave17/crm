"use client";

import { useState } from "react";
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
  Shield,
  FileText,
  Circle,
  Star,
  Heart,
  Zap,
  Target,
  TrendingUp,
  DollarSign,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  Flag,
  Tag,
  Bookmark,
  Home,
  Search,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const ICON_MAP: Record<string, LucideIcon> = {
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
  Star,
  Heart,
  Zap,
  Target,
  TrendingUp,
  DollarSign,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  Flag,
  Tag,
  Bookmark,
  Home,
  Search,
  Filter,
};

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = ICON_MAP[value] ?? Circle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-10 h-10 p-0">
          <SelectedIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-6 gap-1">
          {Object.entries(ICON_MAP).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted transition-colors",
                value === key && "bg-primary/10 text-primary"
              )}
              title={key}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ICON_MAP };
