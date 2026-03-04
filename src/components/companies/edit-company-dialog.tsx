"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPicker } from "@/components/pickers/user-picker";
import { useUpdateCompany } from "@/lib/hooks/use-companies";
import { toast } from "sonner";

interface EditCompanyDialogProps {
  company: {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    description: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
    ownerId: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  domain: string;
  industry: string;
  size: string | undefined;
  description: string;
  linkedinUrl: string;
  websiteUrl: string;
  ownerId: string | undefined;
}

export function EditCompanyDialog({
  company,
  open,
  onOpenChange,
}: EditCompanyDialogProps) {
  const updateCompany = useUpdateCompany();

  const [form, setForm] = useState<FormState>({
    name: company.name,
    domain: company.domain ?? "",
    industry: company.industry ?? "",
    size: company.size ?? undefined,
    description: company.description ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    websiteUrl: company.websiteUrl ?? "",
    ownerId: company.ownerId ?? undefined,
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: company.name,
        domain: company.domain ?? "",
        industry: company.industry ?? "",
        size: company.size ?? undefined,
        description: company.description ?? "",
        linkedinUrl: company.linkedinUrl ?? "",
        websiteUrl: company.websiteUrl ?? "",
        ownerId: company.ownerId ?? undefined,
      });
    }
  }, [company, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: Record<string, unknown> = {
      name: form.name,
      domain: form.domain || undefined,
      industry: form.industry || undefined,
      size: form.size || undefined,
      description: form.description || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      ownerId: form.ownerId || null,
    };

    updateCompany.mutate(
      { id: company.id, data },
      {
        onSuccess: () => {
          toast.success("Company updated");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Domain row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-company-name">Name *</Label>
              <Input
                id="edit-company-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company-domain">Domain</Label>
              <Input
                id="edit-company-domain"
                value={form.domain}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, domain: e.target.value }))
                }
                placeholder="example.com"
              />
            </div>
          </div>

          {/* Industry + Size row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-company-industry">Industry</Label>
              <Input
                id="edit-company-industry"
                value={form.industry}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, industry: e.target.value }))
                }
                placeholder="e.g. Technology, Education"
              />
            </div>
            <div className="space-y-2">
              <Label>Size</Label>
              <Select
                value={form.size ?? "none"}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    size: v === "none" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1-10">1-10</SelectItem>
                  <SelectItem value="11-50">11-50</SelectItem>
                  <SelectItem value="51-200">51-200</SelectItem>
                  <SelectItem value="201-1000">201-1000</SelectItem>
                  <SelectItem value="1000+">1000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-company-description">Description</Label>
            <Textarea
              id="edit-company-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-company-linkedin">LinkedIn URL</Label>
            <Input
              id="edit-company-linkedin"
              value={form.linkedinUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))
              }
              placeholder="https://linkedin.com/company/..."
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-company-website">Website URL</Label>
            <Input
              id="edit-company-website"
              value={form.websiteUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))
              }
              placeholder="https://..."
            />
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>Owner</Label>
            <UserPicker
              value={form.ownerId ?? null}
              onChange={(userId) =>
                setForm((prev) => ({
                  ...prev,
                  ownerId: userId ?? undefined,
                }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateCompany.isPending}>
              {updateCompany.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
