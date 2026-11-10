"use client";

import { useState } from "react";
import { UserPlus, ArrowUpDown, Tag, Trash2, Loader2, Building2, Shuffle, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPicker } from "@/components/pickers/user-picker";
import { CompanyPicker } from "@/components/pickers/company-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useBulkReassignContacts,
  useBulkStatusContacts,
  useBulkTagContacts,
  useBulkDeleteContacts,
  useBulkLinkCompany,
} from "@/lib/hooks/use-bulk-actions";
import { useTags } from "@/lib/hooks/use-tags";
import { RoundRobinDialog } from "@/components/bulk/round-robin-dialog";
import { MergeContactsDialog } from "@/components/merge/merge-contacts-dialog";
import { toast } from "sonner";
import { ReassignConfirmDialog, type OwnershipConflict } from "@/components/contacts/reassign-confirm-dialog";

interface ContactsBulkActionsProps {
  selectedIds: string[];
  onComplete: () => void;
}

export function ContactsBulkActions({ selectedIds, onComplete }: ContactsBulkActionsProps) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);
  const [roundRobinOpen, setRoundRobinOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeContacts, setMergeContacts] = useState<[{ id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null }, { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null }] | null>(null);
  const [ownerConflicts, setOwnerConflicts] = useState<OwnershipConflict[]>([]);

  const reassign = useBulkReassignContacts();
  const changeStatus = useBulkStatusContacts();
  const addTag = useBulkTagContacts();
  const deleteBulk = useBulkDeleteContacts();
  const linkCompany = useBulkLinkCompany();

  const { data: tagsList } = useTags();

  const isPending = reassign.isPending || changeStatus.isPending || addTag.isPending || deleteBulk.isPending || linkCompany.isPending;

  function handleReassign(userId: string | null) {
    if (!userId) return;
    reassign.mutate(
      { contactIds: selectedIds, newOwnerId: userId },
      {
        onSuccess: (data) => {
          toast.success(`Reassigned ${data.count} contacts`);
          setReassignOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleStatus(status: string) {
    changeStatus.mutate(
      { contactIds: selectedIds, status },
      {
        onSuccess: (data) => {
          toast.success(`Updated status for ${data.count} contacts`);
          setStatusOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleTag(tagId: string) {
    addTag.mutate(
      { contactIds: selectedIds, tagId },
      {
        onSuccess: (data) => {
          toast.success(`Tag added to ${data.count} contacts`);
          setTagOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleLinkCompany(companyId: string | null) {
    if (!companyId) return;
    linkCompany.mutate(
      { contactIds: selectedIds, companyId },
      {
        onSuccess: (data) => {
          toast.success(`Linked ${data.count} contacts to company`);
          setLinkCompanyOpen(false);
          onComplete();

          if (data.ownershipConflicts?.length > 0) {
            setOwnerConflicts(data.ownershipConflicts);
          }
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDelete() {
    deleteBulk.mutate(
      { contactIds: selectedIds },
      {
        onSuccess: (data) => {
          toast.success(`Deleted ${data.count} contacts`);
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
            Reassign {selectedIds.length} contacts to:
          </p>
          <UserPicker value={null} onChange={handleReassign} placeholder="Select new owner..." />
        </PopoverContent>
      </Popover>

      {/* Change Status */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {changeStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpDown className="mr-2 h-4 w-4" />}
            Status
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Change status for {selectedIds.length} contacts:
          </p>
          <Select onValueChange={handleStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
              <SelectItem value="closed_lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>

      {/* Add Tag */}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {addTag.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Add tag to {selectedIds.length} contacts:
          </p>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {(tagsList as Array<{ id: string; name: string; color: string }> | undefined)?.map(
              (tag) => (
                <button
                  key={tag.id}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  onClick={() => handleTag(tag.id)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              )
            )}
            {(!tagsList || (tagsList as unknown[]).length === 0) && (
              <p className="text-xs text-muted-foreground px-2 py-1">No tags available</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Link Company */}
      <Popover open={linkCompanyOpen} onOpenChange={setLinkCompanyOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {linkCompany.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
            Link Company
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Link {selectedIds.length} contacts to:
          </p>
          <CompanyPicker value={null} onChange={handleLinkCompany} placeholder="Select company..." />
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
            <AlertDialogTitle>Delete {selectedIds.length} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All associated activities, tasks, and
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
                fetch(`/api/contacts/${selectedIds[0]}`).then(r => r.json()),
                fetch(`/api/contacts/${selectedIds[1]}`).then(r => r.json()),
              ]);
              setMergeContacts([res1, res2]);
              setMergeOpen(true);
            } catch {
              toast.error("Failed to load contacts for merge");
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
        entityType="contact"
        onComplete={onComplete}
      />

      {mergeContacts && (
        <MergeContactsDialog
          master={mergeContacts[0]}
          duplicate={mergeContacts[1]}
          open={mergeOpen}
          onOpenChange={(open) => {
            setMergeOpen(open);
            if (!open) {
              setMergeContacts(null);
              onComplete();
            }
          }}
        />
      )}

      <ReassignConfirmDialog
        conflicts={ownerConflicts}
        open={ownerConflicts.length > 0}
        onOpenChange={(open) => {
          if (!open) setOwnerConflicts([]);
        }}
      />
    </>
  );
}
