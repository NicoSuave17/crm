"use client";

import { useState } from "react";
import { useAlerts } from "@/lib/hooks/use-dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  Bell,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

const severityConfig: Record<
  string,
  { color: string; icon: typeof AlertTriangle }
> = {
  critical: {
    color: "text-[#E86644] dark:text-[#E86644]",
    icon: AlertTriangle,
  },
  warning: {
    color: "text-[#FA4616] dark:text-[#FA4616]",
    icon: TrendingDown,
  },
  info: {
    color: "text-[#1754D8] dark:text-[#1754D8]",
    icon: Bell,
  },
};

const severityBadge: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
};

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

export default function AlertsPage() {
  const [filter, setFilter] = useState("all");
  const unreadOnly = filter === "unread";
  const { data: alerts, isLoading } = useAlerts(unreadOnly);
  const queryClient = useQueryClient();

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
      toast.success("All alerts marked as read");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const unreadCount = alerts?.filter((a: Alert) => !a.isRead).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Alerts</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread"
                ? "No unread alerts"
                : "No alerts yet. Everything looks good."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: Alert) => {
            const config = severityConfig[alert.severity] ?? severityConfig.info;
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={!alert.isRead ? "border-primary/30 bg-primary/[0.02]" : ""}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Icon
                    className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <Badge
                        variant={severityBadge[alert.severity] ?? "outline"}
                        className="text-[10px]"
                      >
                        {alert.severity}
                      </Badge>
                      {!alert.isRead && (
                        <Badge variant="secondary" className="text-[10px]">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {alert.contactId && (
                        <Link
                          href={`/contacts/${alert.contactId}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {alert.contactFirstName} {alert.contactLastName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {!alert.isRead && (
                        <button
                          onClick={() => markRead.mutate(alert.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
