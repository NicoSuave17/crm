"use client";

import { useState, useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPicker } from "@/components/pickers/user-picker";
import { CustomFieldsFormSection } from "@/components/custom-fields/custom-fields-form-section";
import { useUpdateContact } from "@/lib/hooks/use-contacts";
import { VERTICALS } from "@/lib/constants/verticals";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";

interface EditContactDialogProps {
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    type: string;
    status: string;
    tier: string | null;
    ownerId: string | null;
    healthScore: number | null;
    whopUsername: string | null;
    vertical: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
    linkedinUrl: string | null;
    title: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    source: string | null;
    sourceDetails: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  address: string;
  city: string;
  state: string;
  country: string;
  type: string;
  status: string;
  tier: string | undefined;
  vertical: string | undefined;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  ownerId: string | undefined;
  healthScore: number | undefined;
  whopUsername: string;
  source: string | undefined;
  sourceDetails: string;
}

export function EditContactDialog({
  contact,
  open,
  onOpenChange,
}: EditContactDialogProps) {
  const updateContact = useUpdateContact();
  const { getLabel } = useFieldLabels();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});

  // Fetch existing custom field values
  const { data: existingCfValues } = useQuery({
    queryKey: ["custom-field-values", contact.id],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entityId=${contact.id}`);
      if (!res.ok) return [];
      return res.json() as Promise<{ fieldDefinitionId: string; textValue: string | null; numberValue: string | null; booleanValue: boolean | null; dateValue: string | null; fieldType: string }[]>;
    },
    enabled: open,
  });

  useEffect(() => {
    if (existingCfValues && open) {
      const vals: Record<string, string | boolean> = {};
      for (const v of existingCfValues) {
        if (v.fieldType === "boolean") {
          vals[v.fieldDefinitionId] = v.booleanValue ?? false;
        } else if (v.fieldType === "number" || v.fieldType === "currency") {
          vals[v.fieldDefinitionId] = v.numberValue ?? "";
        } else if (v.fieldType === "date") {
          vals[v.fieldDefinitionId] = v.dateValue ? new Date(v.dateValue).toISOString().slice(0, 10) : "";
        } else {
          vals[v.fieldDefinitionId] = v.textValue ?? "";
        }
      }
      setCustomFieldValues(vals);
    }
  }, [existingCfValues, open]);

  const [form, setForm] = useState<FormState>({
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    title: contact.title ?? "",
    address: contact.address ?? "",
    city: contact.city ?? "",
    state: contact.state ?? "",
    country: contact.country ?? "",
    type: contact.type,
    status: contact.status,
    tier: contact.tier ?? undefined,
    vertical: contact.vertical ?? undefined,
    linkedinUrl: contact.linkedinUrl ?? "",
    twitterUrl: contact.twitterUrl ?? "",
    websiteUrl: contact.websiteUrl ?? "",
    ownerId: contact.ownerId ?? undefined,
    healthScore: contact.healthScore ?? undefined,
    whopUsername: contact.whopUsername ?? "",
    source: contact.source ?? undefined,
    sourceDetails: contact.sourceDetails ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        firstName: contact.firstName,
        lastName: contact.lastName ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        title: contact.title ?? "",
        address: contact.address ?? "",
        city: contact.city ?? "",
        state: contact.state ?? "",
        country: contact.country ?? "",
        type: contact.type,
        status: contact.status,
        tier: contact.tier ?? undefined,
        vertical: contact.vertical ?? undefined,
        linkedinUrl: contact.linkedinUrl ?? "",
        twitterUrl: contact.twitterUrl ?? "",
        websiteUrl: contact.websiteUrl ?? "",
        ownerId: contact.ownerId ?? undefined,
        healthScore: contact.healthScore ?? undefined,
        whopUsername: contact.whopUsername ?? "",
        source: contact.source ?? undefined,
        sourceDetails: contact.sourceDetails ?? "",
      });
    }
  }, [contact, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      title: form.title || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      country: form.country || undefined,
      type: form.type,
      status: form.status,
      tier: form.tier || undefined,
      vertical: form.vertical || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      twitterUrl: form.twitterUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      ownerId: form.ownerId || null,
      healthScore:
        form.healthScore !== undefined && form.healthScore !== null
          ? Number(form.healthScore)
          : null,
      whopUsername: form.whopUsername || undefined,
      source: form.source || undefined,
      sourceDetails: form.sourceDetails || undefined,
    };

    updateContact.mutate(
      { id: contact.id, data },
      {
        onSuccess: async () => {
          // Save custom field values
          for (const [fieldId, value] of Object.entries(customFieldValues)) {
            const body: Record<string, unknown> = { fieldDefinitionId: fieldId, entityId: contact.id };
            if (typeof value === "boolean") {
              body.booleanValue = value;
            } else if (!isNaN(Number(value)) && value !== "") {
              body.numberValue = String(value);
            } else {
              body.textValue = String(value);
            }
            await fetch("/api/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          }
          toast.success("Contact updated");
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
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">{getLabel("firstName", "First Name")} *</Label>
              <Input
                id="edit-firstName"
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">{getLabel("lastName", "Last Name")}</Label>
              <Input
                id="edit-lastName"
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">{getLabel("email", "Email")}</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone">{getLabel("phone", "Phone")}</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g. CEO, Account Manager"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={form.state}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, state: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-country">Country</Label>
            <Input
              id="edit-country"
              value={form.country}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, country: e.target.value }))
              }
            />
          </div>

          {/* Status + Tier row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{getLabel("status", "Status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, status: v }))
                }
              >
                <SelectTrigger className="w-full">
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
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    tier: v === "none" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
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

          {/* Type + Source row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{getLabel("type", "Type")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, type: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="enterprise_prospect">Enterprise Prospect</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={form.source ?? "none"}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    source: v === "none" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source Details */}
          <div className="space-y-2">
            <Label htmlFor="edit-sourceDetails">Source Details</Label>
            <Input
              id="edit-sourceDetails"
              value={form.sourceDetails}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sourceDetails: e.target.value }))
              }
              placeholder="e.g. referred by John, LinkedIn campaign Q1"
            />
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

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-linkedinUrl">LinkedIn URL</Label>
            <Input
              id="edit-linkedinUrl"
              value={form.linkedinUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))
              }
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          {/* Twitter URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-twitterUrl">Twitter URL</Label>
            <Input
              id="edit-twitterUrl"
              value={form.twitterUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, twitterUrl: e.target.value }))
              }
              placeholder="https://twitter.com/..."
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-websiteUrl">Website URL</Label>
            <Input
              id="edit-websiteUrl"
              value={form.websiteUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))
              }
              placeholder="https://..."
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

          {/* Health Score + Whop Username row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-healthScore">{getLabel("healthScore", "Health Score")}</Label>
              <Input
                id="edit-healthScore"
                type="number"
                min={0}
                max={100}
                value={form.healthScore ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    healthScore: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                placeholder="0-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whopUsername">Whop Username</Label>
              <Input
                id="edit-whopUsername"
                value={form.whopUsername}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    whopUsername: e.target.value,
                  }))
                }
                placeholder="username"
              />
            </div>
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
            <Button type="submit" disabled={updateContact.isPending}>
              {updateContact.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
