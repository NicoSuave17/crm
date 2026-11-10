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

interface CompanyRecord {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  description: string | null;
}

interface MergeCompaniesDialogProps {
  master: CompanyRecord;
  duplicate: CompanyRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MERGE_FIELDS = [
  { key: "name", label: "Name" },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "size", label: "Size" },
  { key: "description", label: "Description" },
] as const;

export function MergeCompaniesDialog({
  master,
  duplicate,
  open,
  onOpenChange,
}: MergeCompaniesDialogProps) {
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
      const res = await fetch("/api/companies/merge", {
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
      toast.success("Companies merged successfully");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
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
          <DialogTitle>Merge Companies</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which value to keep for each field. The duplicate record will be deleted and all
            linked contacts, deals, and activities will be transferred to the master record.
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
