"use client";

import { useState } from "react";
import { Bell, AlertTriangle, TrendingDown, Clock, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
