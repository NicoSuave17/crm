"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useBulkRoundRobin } from "@/lib/hooks/use-bulk-actions";
import { useUsers } from "@/lib/hooks/use-users";
import { toast } from "sonner";
import { Loader2, Shuffle } from "lucide-react";

interface RoundRobinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds: string[];
  entityType: "contact" | "deal" | "company";
  onComplete: () => void;
}

export function RoundRobinDialog({
  open,
  onOpenChange,
  entityIds,
  entityType,
  onComplete,
}: RoundRobinDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const roundRobin = useBulkRoundRobin();
  const { data: users = [] } = useUsers();

  const activeUsers = (
    users as Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      isActive: boolean;
    }>
  ).filter((u) => u.isActive);

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function handleDistribute() {
    const userIds = Array.from(selectedUserIds);
    roundRobin.mutate(
      { entityIds, entityType, userIds },
      {
        onSuccess: (data) => {
          toast.success(`Round-robin assigned ${data.count} ${entityType}s`);
          onOpenChange(false);
          setSelectedUserIds(new Set());
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  // Preview distribution
  const userIds = Array.from(selectedUserIds);
  const distribution = new Map<string, number>();
  if (userIds.length > 0) {
    for (let i = 0; i < entityIds.length; i++) {
      const userId = userIds[i % userIds.length];
      distribution.set(userId, (distribution.get(userId) ?? 0) + 1);
    }
  }

  const entityLabel = entityType === "contact" ? "contacts" : entityType === "deal" ? "deals" : "companies";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Round-Robin Assignment
          </DialogTitle>
          <DialogDescription>
            Evenly distribute {entityIds.length} {entityLabel} across selected team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {activeUsers.map((user) => {
            const checked = selectedUserIds.has(user.id);
            const count = distribution.get(user.id) ?? 0;
            return (
              <label
                key={user.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleUser(user.id)}
                />
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium">
                  {user.firstName} {user.lastName}
                </span>
                {checked && count > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {count}
                  </span>
                )}
              </label>
            );
          })}
          {activeUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active team members found.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={selectedUserIds.size === 0 || roundRobin.isPending}
          >
            {roundRobin.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="mr-2 h-4 w-4" />
            )}
            Distribute ({entityIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
