"use client";

import { useState } from "react";
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
import { useCreateCompany } from "@/lib/hooks/use-companies";
import { toast } from "sonner";
import type { CreateCompanyInput } from "@/lib/validators/company";

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyForm({ open, onOpenChange }: CompanyFormProps) {
  const createCompany = useCreateCompany();
  const [form, setForm] = useState<CreateCompanyInput>({
    name: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createCompany.mutate(form, {
      onSuccess: () => {
        toast.success("Company created");
        onOpenChange(false);
        setForm({ name: "" });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Domain row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Name *</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-domain">Domain</Label>
              <Input
                id="company-domain"
                value={form.domain ?? ""}
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
              <Label htmlFor="company-industry">Industry</Label>
              <Input
                id="company-industry"
                value={form.industry ?? ""}
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
                    size: v === "none" ? undefined : (v as CreateCompanyInput["size"]),
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
            <Label htmlFor="company-description">Description</Label>
            <Textarea
              id="company-description"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="company-linkedin">LinkedIn URL</Label>
            <Input
              id="company-linkedin"
              value={form.linkedinUrl ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))
              }
              placeholder="https://linkedin.com/company/..."
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="company-website">Website URL</Label>
            <Input
              id="company-website"
              value={form.websiteUrl ?? ""}
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
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
