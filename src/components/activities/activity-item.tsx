"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils/format";
import { useUpdateActivity, useDeleteActivity } from "@/lib/hooks/use-activities";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Linkedin,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Settings,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: Phone,
  email_sent: Mail,
  email_received: Mail,
  meeting: Calendar,
  linkedin_message: Linkedin,
  deal_stage_change: ArrowRight,
  health_score_change: TrendingUp,
  churn_alert: AlertTriangle,
  gmv_milestone: TrendingUp,
  system_event: Settings,
  task_completed: Settings,
};

const typeLabels: Record<string, string> = {
  note: "Note",
  call: "Call",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting: "Meeting",
  linkedin_message: "LinkedIn",
  deal_stage_change: "Deal Update",
  health_score_change: "Health Change",
  churn_alert: "Churn Alert",
  gmv_milestone: "GMV Milestone",
  system_event: "System",
  task_completed: "Task Completed",
};

const EDITABLE_TYPES = new Set(["note", "call", "email_sent", "meeting", "linkedin_message"]);

interface ActivityItemProps {
  activity: {
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    userId: string | null;
    userFirstName: string | null;
    userLastName: string | null;
    userAvatarUrl: string | null;
    occurredAt: string;
    duration: number | null;
    metadata: Record<string, unknown> | null;
    nextFollowUpDate: string | null;
  };
  currentUserId?: string;
}

export function ActivityItem({ activity, currentUserId }: ActivityItemProps) {
  const Icon = typeIcons[activity.type] ?? MessageSquare;
  const label = typeLabels[activity.type] ?? activity.type;

  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(activity.subject ?? "");
  const [editBody, setEditBody] = useState(activity.body ?? "");
  const [editDuration, setEditDuration] = useState(activity.duration?.toString() ?? "");

  const updateActivity = useUpdateActivity();
  const deleteActivityMutation = useDeleteActivity();

  const isOwner = currentUserId && activity.userId && currentUserId === activity.userId;
  const canEdit = isOwner && EDITABLE_TYPES.has(activity.type);

  function handleSave() {
    updateActivity.mutate(
      {
        id: activity.id,
        data: {
          subject: editSubject || null,
          body: editBody || null,
          duration: editDuration ? parseInt(editDuration) : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Activity updated");
          setEditing(false);
        },
        onError: () => toast.error("Failed to update activity"),
      }
    );
  }

  function handleDelete() {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    deleteActivityMutation.mutate(activity.id, {
      onSuccess: () => toast.success("Activity deleted"),
      onError: () => toast.error("Failed to delete activity"),
    });
  }

  return (
    <div className="flex gap-3 py-3 group">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          {activity.duration && (
            <span className="text-xs text-muted-foreground">
              · {activity.duration}min
            </span>
          )}
          {activity.metadata?.outcome ? (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
              {String(activity.metadata.outcome).replace(/_/g, " ")}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(activity.occurredAt), {
              addSuffix: true,
            })}
          </span>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditSubject(activity.subject ?? "");
                  setEditBody(activity.body ?? "");
                  setEditDuration(activity.duration?.toString() ?? "");
                  setEditing(true);
                }}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="space-y-2 mt-1">
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Subject"
              className="h-8 text-sm"
            />
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="Details"
              rows={2}
              className="text-sm"
            />
            {(activity.type === "call" || activity.type === "meeting") && (
              <Input
                type="number"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                placeholder="Duration (min)"
                className="h-8 text-sm w-36"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleSave} disabled={updateActivity.isPending}>
                {updateActivity.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {activity.subject && (
              <p className="text-sm font-medium mt-1">{activity.subject}</p>
            )}
            {activity.body && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {activity.body}
              </p>
            )}
            {activity.nextFollowUpDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Follow-up: {new Date(activity.nextFollowUpDate).toLocaleDateString()}
              </p>
            )}
          </>
        )}

        {activity.userFirstName && (
          <div className="flex items-center gap-1.5 mt-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={activity.userAvatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(activity.userFirstName, activity.userLastName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {activity.userFirstName} {activity.userLastName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
