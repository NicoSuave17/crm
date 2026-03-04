"use client";

import { UserButton } from "@clerk/nextjs";
import { Search, Menu } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopNavProps {
  onMobileMenuToggle: () => void;
}

export function TopNav({ onMobileMenuToggle }: TopNavProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts, deals... (⌘K)"
          className="pl-9 bg-muted/50"
          readOnly
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <NotificationBell />

        {/* User */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </header>
  );
}
