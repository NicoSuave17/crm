"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface OwnershipConflict {
  contactId: string;
  contactName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  companyOwnerId: string;
  companyOwnerName: string;
}

interface ReassignConfirmDialogProps {
  conflicts: OwnershipConflict[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReassignConfirmDialog({
  conflicts,
  open,
  onOpenChange,
}: ReassignConfirmDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(conflicts.map((c) => c.contactId)));
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const allSelected = selected.size === conflicts.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(conflicts.map((c) => c.contactId)));
    }
  }

  function toggleOne(contactId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }

  async function handleConfirm() {
    const toReassign = conflicts.filter((c) => selected.has(c.contactId));
    if (toReassign.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsPending(true);
    try {
      const results = await Promise.allSettled(
        toReassign.map((c) =>
          fetch(`/api/contacts/${c.contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId: c.companyOwnerId }),
          }).then((res) => {
            if (!res.ok) throw new Error(`Failed to reassign ${c.contactName}`);
            return res.json();
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Reassigned ${succeeded} contact${succeeded !== 1 ? "s" : ""}`);
      } else {
        toast.warning(`Reassigned ${succeeded}, failed ${failed}`);
      }

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    } catch {
      toast.error("Failed to reassign contacts");
    } finally {
      setIsPending(false);
    }
  }

  // Reset selection when conflicts change
  if (conflicts.length > 0 && selected.size === 0 && open) {
    setSelected(new Set(conflicts.map((c) => c.contactId)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign Contact Ownership</DialogTitle>
          <DialogDescription>
            {conflicts.length === 1
              ? "This contact is already assigned to a different owner. Reassign to the company owner?"
              : `${conflicts.length} contacts are already assigned to different owners. Select which to reassign to the company owner.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {conflicts.length > 1 && (
            <label className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer border-b mb-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Select All</span>
            </label>
          )}

          {conflicts.map((conflict) => (
            <label
              key={conflict.contactId}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={selected.has(conflict.contactId)}
                onCheckedChange={() => toggleOne(conflict.contactId)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conflict.contactName}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{conflict.currentOwnerName}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="truncate font-medium text-foreground">{conflict.companyOwnerName}</span>
                </div>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || selected.size === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              `Reassign${selected.size > 0 ? ` (${selected.size})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
