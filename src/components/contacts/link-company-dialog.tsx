"use client";

import { useState } from "react";
import { useLinkCompany } from "@/lib/hooks/use-contact-companies";
import { CompanyPicker } from "@/components/pickers/company-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface LinkCompanyDialogProps {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkCompanyDialog({
  contactId,
  open,
  onOpenChange,
}: LinkCompanyDialogProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const linkCompany = useLinkCompany();

  function handleSubmit() {
    if (!selectedCompanyId) return;

    linkCompany.mutate(
      {
        contactId,
        companyId: selectedCompanyId,
        role: role.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Company linked");
          setSelectedCompanyId(null);
          setRole("");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to link company");
        },
      }
    );
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setSelectedCompanyId(null);
      setRole("");
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Company</DialogTitle>
          <DialogDescription>
            Link a company to this contact. Selecting an already-linked company
            will update the role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <CompanyPicker
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              placeholder="Search and select a company..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. CEO, CTO, Founder, Employee"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCompanyId || linkCompany.isPending}
          >
            {linkCompany.isPending ? "Linking..." : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
