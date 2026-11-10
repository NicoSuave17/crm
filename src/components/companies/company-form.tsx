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
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/pickers/user-picker";
import { CustomFieldsFormSection } from "@/components/custom-fields/custom-fields-form-section";
import { useCreateCompany } from "@/lib/hooks/use-companies";
import { VERTICALS } from "@/lib/constants/verticals";
import { toast } from "sonner";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";
import type { CreateCompanyInput } from "@/lib/validators/company";

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyForm({ open, onOpenChange }: CompanyFormProps) {
  const createCompany = useCreateCompany();
  const { getLabel } = useFieldLabels();
  const [form, setForm] = useState<CreateCompanyInput>({
    name: "",
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<Array<{ record: { id: string; name: string; domain: string | null }; confidence: number; matchReason: string }>>([]);

  function doCreate() {
    createCompany.mutate(form, {
      onSuccess: async (data: { id: string }) => {
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          if (value === "" || value === undefined) continue;
          const body: Record<string, unknown> = { fieldDefinitionId: fieldId, entityId: data.id };
          if (typeof value === "boolean") body.booleanValue = value;
          else if (!isNaN(Number(value)) && value !== "") body.numberValue = value;
          else body.textValue = value;
          await fetch("/api/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        }
        toast.success("Company created");
        onOpenChange(false);
        setForm({ name: "" });
        setCustomFieldValues({});
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const params = new URLSearchParams({ name: form.name });
      if (form.domain) params.set("domain", form.domain);

      const res = await fetch(`/api/companies/duplicates?${params}`);
      if (res.ok) {
        const { duplicates } = await res.json();
        if (duplicates && duplicates.length > 0) {
          setDuplicateWarning(duplicates);
          return;
        }
      }
    } catch {
      // If duplicate check fails, proceed with creation
    }

    doCreate();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Domain row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">{getLabel("name", "Name")} *</Label>
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
              <Label htmlFor="company-industry">{getLabel("industry", "Industry")}</Label>
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
              <Label>{getLabel("size", "Size")}</Label>
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

          {/* Vertical */}
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select
              value={form.vertical ?? "none"}
              onValueChange={(v) => setForm((prev) => ({ ...prev, vertical: v === "none" ? undefined : (v as any) }))}
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

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="company-address">Address</Label>
            <Input
              id="company-address"
              value={form.address ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-city">City</Label>
              <Input
                id="company-city"
                value={form.city ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-state">State</Label>
              <Input
                id="company-state"
                value={form.state ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, state: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-country">Country</Label>
            <Input
              id="company-country"
              value={form.country ?? ""}
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
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <AlertDialog open={duplicateWarning.length > 0} onOpenChange={() => setDuplicateWarning([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possible Duplicates Found</AlertDialogTitle>
            <AlertDialogDescription>
              The following existing companies may be duplicates:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-2">
            {duplicateWarning.map((dup) => (
              <div key={dup.record.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">
                  <span className="font-medium">{dup.record.name}</span>
                  {dup.record.domain && <span className="text-muted-foreground ml-2">{dup.record.domain}</span>}
                </div>
                <Badge variant="secondary" className="text-xs">{dup.confidence}% — {dup.matchReason}</Badge>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDuplicateWarning([]); doCreate(); }}>
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
