"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  type?: string;
  status?: string;
}

interface MergeContactsDialogProps {
  master: ContactRecord;
  duplicate: ContactRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MERGE_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
] as const;

export function MergeContactsDialog({
  master,
  duplicate,
  open,
  onOpenChange,
}: MergeContactsDialogProps) {
  const queryClient = useQueryClient();

  const [fieldResolution, setFieldResolution] = useState<Record<string, "master" | "duplicate">>(() => {
    const initial: Record<string, "master" | "duplicate"> = {};
    for (const f of MERGE_FIELDS) {
      initial[f.key] = "master";
    }
    return initial;
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterId: master.id,
          duplicateId: duplicate.id,
          fieldResolution,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Merge failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contacts merged successfully");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which value to keep for each field. The duplicate record will be deleted and all
            linked activities, tasks, and deals will be transferred to the master record.
          </p>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Field</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Master
                    <Badge variant="secondary" className="ml-2 text-[10px]">Keep</Badge>
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    Duplicate
                    <Badge variant="outline" className="ml-2 text-[10px]">Delete</Badge>
                  </th>
                </tr>
              </thead>
              <tbody>
                {MERGE_FIELDS.map((field) => {
                  const masterValue = (master as unknown as Record<string, unknown>)[field.key] as string | null;
                  const duplicateValue = (duplicate as unknown as Record<string, unknown>)[field.key] as string | null;
                  const selected = fieldResolution[field.key];

                  return (
                    <tr key={field.key} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{field.label}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setFieldResolution((prev) => ({ ...prev, [field.key]: "master" }))}
                          className={`rounded px-2 py-1 text-left w-full ${
                            selected === "master" ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent"
                          }`}
                        >
                          {masterValue || <span className="text-muted-foreground">--</span>}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setFieldResolution((prev) => ({ ...prev, [field.key]: "duplicate" }))}
                          className={`rounded px-2 py-1 text-left w-full ${
                            selected === "duplicate" ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent"
                          }`}
                        >
                          {duplicateValue || <span className="text-muted-foreground">--</span>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending}
          >
            {mergeMutation.isPending ? "Merging..." : "Merge & Delete Duplicate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
