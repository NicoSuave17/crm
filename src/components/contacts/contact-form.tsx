"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
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
import { useCreateContact } from "@/lib/hooks/use-contacts";
import { UserPicker } from "@/components/pickers/user-picker";
import { CustomFieldsFormSection } from "@/components/custom-fields/custom-fields-form-section";
import { VERTICALS } from "@/lib/constants/verticals";
import { toast } from "sonner";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";
import type { CreateContactInput } from "@/lib/validators/contact";

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactForm({ open, onOpenChange }: ContactFormProps) {
  const createContact = useCreateContact();
  const { getLabel } = useFieldLabels();
  const [form, setForm] = useState<CreateContactInput>({
    firstName: "",
    type: "creator",
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<Array<{ record: { id: string; firstName: string; lastName: string | null; email: string | null }; confidence: number; matchReason: string }>>([]);

  function handleChange(field: keyof CreateContactInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function doCreate() {
    createContact.mutate(form, {
      onSuccess: async (data: { id: string }) => {
        // Save custom field values
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          if (value === "" || value === undefined) continue;
          const body: Record<string, unknown> = { fieldDefinitionId: fieldId, entityId: data.id };
          if (typeof value === "boolean") {
            body.booleanValue = value;
          } else if (!isNaN(Number(value)) && value !== "") {
            body.numberValue = value;
          } else {
            body.textValue = value;
          }
          await fetch("/api/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        }
        toast.success("Contact created");
        onOpenChange(false);
        setForm({ firstName: "", type: "creator" });
        setCustomFieldValues({});
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Check for duplicates before creating
    try {
      const params = new URLSearchParams({ firstName: form.firstName });
      if (form.lastName) params.set("lastName", form.lastName);
      if (form.email) params.set("email", form.email);
      if (form.phone) params.set("phone", form.phone);

      const res = await fetch(`/api/contacts/duplicates?${params}`);
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
          <DialogTitle>Create Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{getLabel("firstName", "First Name")} *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{getLabel("lastName", "Last Name")}</Label>
              <Input
                id="lastName"
                value={form.lastName ?? ""}
                onChange={(e) => handleChange("lastName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{getLabel("email", "Email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{getLabel("phone", "Phone")}</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={(form as Record<string, unknown>).title as string ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. CEO, Account Manager"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={(form as Record<string, unknown>).address as string ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={(form as Record<string, unknown>).city as string ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={(form as Record<string, unknown>).state as string ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={(form as Record<string, unknown>).country as string ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{getLabel("type", "Type")} *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleChange("type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="enterprise_prospect">
                    Enterprise Prospect
                  </SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={form.source ?? ""}
                onValueChange={(v) => handleChange("source", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status + Tier row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{getLabel("status", "Status")}</Label>
              <Select
                value={form.status ?? "prospect"}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select
                value={form.tier ?? "none"}
                onValueChange={(v) => handleChange("tier", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select
              value={form.vertical ?? "none"}
              onValueChange={(v) => handleChange("vertical", v === "none" ? "" : v)}
            >
              <SelectTrigger>
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

          {/* Source Details */}
          <div className="space-y-2">
            <Label htmlFor="sourceDetails">Source Details</Label>
            <Input
              id="sourceDetails"
              value={(form as Record<string, unknown>).sourceDetails as string ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, sourceDetails: e.target.value }))}
              placeholder="e.g. referred by John, LinkedIn campaign Q1"
            />
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>{getLabel("owner", "Owner")}</Label>
            <UserPicker
              value={form.ownerId ?? null}
              onChange={(userId) =>
                setForm((prev) => ({ ...prev, ownerId: userId ?? undefined }))
              }
            />
          </div>

          {/* Whop Username */}
          <div className="space-y-2">
            <Label htmlFor="whopUsername">Whop Username</Label>
            <Input
              id="whopUsername"
              value={(form as Record<string, unknown>).whopUsername as string ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, whopUsername: e.target.value }))}
              placeholder="username"
            />
          </div>

          {/* Social URLs */}
          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              value={form.linkedinUrl ?? ""}
              onChange={(e) => handleChange("linkedinUrl", e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitterUrl">Twitter URL</Label>
            <Input
              id="twitterUrl"
              value={form.twitterUrl ?? ""}
              onChange={(e) => handleChange("twitterUrl", e.target.value)}
              placeholder="https://twitter.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              value={form.websiteUrl ?? ""}
              onChange={(e) => handleChange("websiteUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <CustomFieldsFormSection
            entityType="contact"
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
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? "Creating..." : "Create Contact"}
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
              The following existing contacts may be duplicates:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-2">
            {duplicateWarning.map((dup) => (
              <div key={dup.record.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">
                  <span className="font-medium">{dup.record.firstName} {dup.record.lastName}</span>
                  {dup.record.email && <span className="text-muted-foreground ml-2">{dup.record.email}</span>}
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
