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
import { CustomFieldsFormSection } from "@/components/custom-fields/custom-fields-form-section";
import { useUpdateCompany } from "@/lib/hooks/use-companies";
import { VERTICALS } from "@/lib/constants/verticals";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";

interface EditCompanyDialogProps {
  company: {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    description: string | null;
    linkedinUrl: string | null;
    vertical: string | null;
    websiteUrl: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
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
  vertical: string | undefined;
  description: string;
  linkedinUrl: string;
  websiteUrl: string;
  address: string;
  city: string;
  state: string;
  country: string;
  ownerId: string | undefined;
}

export function EditCompanyDialog({
  company,
  open,
  onOpenChange,
}: EditCompanyDialogProps) {
  const updateCompany = useUpdateCompany();
  const { getLabel } = useFieldLabels();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});

  const { data: existingCfValues } = useQuery({
    queryKey: ["custom-field-values", company.id],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityId=${company.id}`);
      if (!res.ok) return [];
      return res.json() as Promise<{ fieldDefinitionId: string; textValue: string | null; numberValue: string | null; booleanValue: boolean | null; dateValue: string | null; fieldType: string }[]>;
    },
    enabled: open,
  });

  useEffect(() => {
    if (existingCfValues && open) {
      const vals: Record<string, string | boolean> = {};
      for (const v of existingCfValues) {
        if (v.fieldType === "boolean") vals[v.fieldDefinitionId] = v.booleanValue ?? false;
        else if (v.fieldType === "number" || v.fieldType === "currency") vals[v.fieldDefinitionId] = v.numberValue ?? "";
        else if (v.fieldType === "date") vals[v.fieldDefinitionId] = v.dateValue ? new Date(v.dateValue).toISOString().slice(0, 10) : "";
        else vals[v.fieldDefinitionId] = v.textValue ?? "";
      }
      setCustomFieldValues(vals);
    }
  }, [existingCfValues, open]);

  const [form, setForm] = useState<FormState>({
    name: company.name,
    domain: company.domain ?? "",
    industry: company.industry ?? "",
    size: company.size ?? undefined,
    vertical: company.vertical ?? undefined,
    description: company.description ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    websiteUrl: company.websiteUrl ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    country: company.country ?? "",
    ownerId: company.ownerId ?? undefined,
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: company.name,
        domain: company.domain ?? "",
        industry: company.industry ?? "",
        size: company.size ?? undefined,
        vertical: company.vertical ?? undefined,
        description: company.description ?? "",
        linkedinUrl: company.linkedinUrl ?? "",
        websiteUrl: company.websiteUrl ?? "",
        address: company.address ?? "",
        city: company.city ?? "",
        state: company.state ?? "",
        country: company.country ?? "",
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
      vertical: form.vertical || undefined,
      description: form.description || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      country: form.country || undefined,
      ownerId: form.ownerId || null,
    };

    updateCompany.mutate(
      { id: company.id, data },
      {
        onSuccess: async () => {
          for (const [fieldId, value] of Object.entries(customFieldValues)) {
            const body: Record<string, unknown> = { fieldDefinitionId: fieldId, entityId: company.id };
            if (typeof value === "boolean") body.booleanValue = value;
            else if (!isNaN(Number(value)) && value !== "") body.numberValue = String(value);
            else body.textValue = String(value);
            await fetch("/api/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          }
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
              <Label htmlFor="edit-company-name">{getLabel("name", "Name")} *</Label>
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
              <Label htmlFor="edit-company-industry">{getLabel("industry", "Industry")}</Label>
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
              <Label>{getLabel("size", "Size")}</Label>
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

          {/* Vertical */}
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select
              value={form.vertical ?? "none"}
              onValueChange={(v) => setForm((prev) => ({ ...prev, vertical: v === "none" ? undefined : v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select vertical" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {VERTICALS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="edit-company-address">Address</Label>
            <Input
              id="edit-company-address"
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-company-city">City</Label>
              <Input
                id="edit-company-city"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company-state">State</Label>
              <Input
                id="edit-company-state"
                value={form.state}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, state: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-company-country">Country</Label>
            <Input
              id="edit-company-country"
              value={form.country}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, country: e.target.value }))
              }
            />
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>{getLabel("owner", "Owner")}</Label>
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

          <CustomFieldsFormSection
            entityType="company"
            values={customFieldValues}
            onChange={(fieldId, value) =>
              setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
            }
          />

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
