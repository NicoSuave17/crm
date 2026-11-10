"use client";

import { useState } from "react";
import { UserPlus, Trash2, Loader2, Shuffle, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPicker } from "@/components/pickers/user-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useBulkReassignCompanies,
  useBulkDeleteCompanies,
} from "@/lib/hooks/use-bulk-actions";
import { RoundRobinDialog } from "@/components/bulk/round-robin-dialog";
import { MergeCompaniesDialog } from "@/components/merge/merge-companies-dialog";
import { toast } from "sonner";

interface CompaniesBulkActionsProps {
  selectedIds: string[];
  onComplete: () => void;
}

export function CompaniesBulkActions({ selectedIds, onComplete }: CompaniesBulkActionsProps) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [roundRobinOpen, setRoundRobinOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeCompanies, setMergeCompanies] = useState<[{ id: string; name: string; domain: string | null; industry: string | null; size: string | null; description: string | null }, { id: string; name: string; domain: string | null; industry: string | null; size: string | null; description: string | null }] | null>(null);

  const reassign = useBulkReassignCompanies();
  const deleteBulk = useBulkDeleteCompanies();

  const isPending = reassign.isPending || deleteBulk.isPending;

  function handleReassign(userId: string | null) {
    if (!userId) return;
    reassign.mutate(
      { companyIds: selectedIds, newOwnerId: userId },
      {
        onSuccess: (data) => {
          toast.success(`Reassigned ${data.count} companies`);
          setReassignOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDelete() {
    deleteBulk.mutate(
      { companyIds: selectedIds },
      {
        onSuccess: (data) => {
          toast.success(`Deleted ${data.count} companies`);
          setDeleteOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <>
      {/* Reassign */}
      <Popover open={reassignOpen} onOpenChange={setReassignOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {reassign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Reassign
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Reassign {selectedIds.length} companies to:
          </p>
          <UserPicker value={null} onChange={handleReassign} placeholder="Select new owner..." />
        </PopoverContent>
      </Popover>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => setDeleteOpen(true)}
      >
        {deleteBulk.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Delete
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} companies?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All associated contacts, activities, tasks, and
              deals will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {deleteBulk.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge (only when exactly 2 selected) */}
      {selectedIds.length === 2 && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={async () => {
            try {
              const [res1, res2] = await Promise.all([
                fetch(`/api/companies/${selectedIds[0]}`).then(r => r.json()),
                fetch(`/api/companies/${selectedIds[1]}`).then(r => r.json()),
              ]);
              setMergeCompanies([res1, res2]);
              setMergeOpen(true);
            } catch {
              toast.error("Failed to load companies for merge");
            }
          }}
        >
          <Merge className="mr-2 h-4 w-4" />
          Merge
        </Button>
      )}

      {/* Round Robin */}
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setRoundRobinOpen(true)}>
        <Shuffle className="mr-2 h-4 w-4" />
        Round Robin
      </Button>
      <RoundRobinDialog
        open={roundRobinOpen}
        onOpenChange={setRoundRobinOpen}
        entityIds={selectedIds}
        entityType="company"
        onComplete={onComplete}
      />

      {mergeCompanies && (
        <MergeCompaniesDialog
          master={mergeCompanies[0]}
          duplicate={mergeCompanies[1]}
          open={mergeOpen}
          onOpenChange={(open) => {
            setMergeOpen(open);
            if (!open) {
              setMergeCompanies(null);
              onComplete();
            }
          }}
        />
      )}
    </>
  );
}
