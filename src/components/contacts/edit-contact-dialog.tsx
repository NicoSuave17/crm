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
import { useUpdateContact } from "@/lib/hooks/use-contacts";
import { toast } from "sonner";

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
    twitterUrl: string | null;
    websiteUrl: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  tier: string | undefined;
  twitterUrl: string;
  websiteUrl: string;
  ownerId: string | undefined;
  healthScore: number | undefined;
  whopUsername: string;
}

export function EditContactDialog({
  contact,
  open,
  onOpenChange,
}: EditContactDialogProps) {
  const updateContact = useUpdateContact();

  const [form, setForm] = useState<FormState>({
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    status: contact.status,
    tier: contact.tier ?? undefined,
    twitterUrl: contact.twitterUrl ?? "",
    websiteUrl: contact.websiteUrl ?? "",
    ownerId: contact.ownerId ?? undefined,
    healthScore: contact.healthScore ?? undefined,
    whopUsername: contact.whopUsername ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        firstName: contact.firstName,
        lastName: contact.lastName ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        status: contact.status,
        tier: contact.tier ?? undefined,
        twitterUrl: contact.twitterUrl ?? "",
        websiteUrl: contact.websiteUrl ?? "",
        ownerId: contact.ownerId ?? undefined,
        healthScore: contact.healthScore ?? undefined,
        whopUsername: contact.whopUsername ?? "",
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
      status: form.status,
      tier: form.tier || undefined,
      twitterUrl: form.twitterUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      ownerId: form.ownerId || null,
      healthScore:
        form.healthScore !== undefined && form.healthScore !== null
          ? Number(form.healthScore)
          : null,
      whopUsername: form.whopUsername || undefined,
    };

    updateContact.mutate(
      { id: contact.id, data },
      {
        onSuccess: () => {
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
              <Label htmlFor="edit-firstName">First Name *</Label>
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
              <Label htmlFor="edit-lastName">Last Name</Label>
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
            <Label htmlFor="edit-email">Email</Label>
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
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          {/* Status + Tier row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
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

          {/* Health Score + Whop Username row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-healthScore">Health Score</Label>
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
