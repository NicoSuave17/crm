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
import { useCreateDeal } from "@/lib/hooks/use-deals";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useContactCompanies, useCompanyContacts } from "@/lib/hooks/use-contact-companies";
import { CompanyPicker } from "@/components/pickers/company-picker";
import { UserPicker } from "@/components/pickers/user-picker";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: { id: string; name: string }[];
  defaultContactId?: string;
  defaultCompanyId?: string;
}

export function DealForm({
  open,
  onOpenChange,
  pipelineId,
  stages,
  defaultContactId,
  defaultCompanyId,
}: DealFormProps) {
  const createDeal = useCreateDeal();
  const [form, setForm] = useState({
    title: "",
    description: "",
    stageId: stages[0]?.id ?? "",
    contactId: defaultContactId ?? "",
    companyId: defaultCompanyId ?? "",
    ownerId: "" as string,
    value: "",
    expectedMrr: "",
    expectedCloseDate: "",
    currency: "USD" as string,
    priority: "medium" as string,
  });

  // When creating from company context, only show that company's contacts
  const { data: companyContacts } = useCompanyContacts(defaultCompanyId ?? "");

  // When a contact is selected, fetch their companies to auto-populate
  const { data: contactCompanies } = useContactCompanies(
    !defaultCompanyId && form.contactId ? form.contactId : ""
  );

  // For general contact list (no company filter)
  const { data: contactsData } = useContacts({ limit: 100 });

  // Auto-populate company when contact is selected (only if not in company context)
  useEffect(() => {
    if (defaultCompanyId || !contactCompanies) return;
    if (contactCompanies.length === 1) {
      setForm((prev) => ({ ...prev, companyId: contactCompanies[0].companyId }));
    } else if (contactCompanies.length === 0) {
      setForm((prev) => ({ ...prev, companyId: "" }));
    }
  }, [contactCompanies, defaultCompanyId]);

  // Build the contacts list depending on context
  const contactsList = defaultCompanyId && companyContacts
    ? companyContacts.map((c) => ({
        id: c.contactId,
        firstName: c.firstName,
        lastName: c.lastName,
      }))
    : (contactsData?.data as { id: string; firstName: string; lastName: string | null }[] | undefined) ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.contactId || !form.stageId) return;

    createDeal.mutate(
      {
        title: form.title,
        description: form.description || undefined,
        pipelineId,
        stageId: form.stageId,
        contactId: form.contactId,
        companyId: form.companyId || defaultCompanyId || undefined,
        ownerId: form.ownerId || undefined,
        value: form.value || undefined,
        expectedMrr: form.expectedMrr || undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        priority: form.priority as "low" | "medium" | "high" | "urgent",
      },
      {
        onSuccess: () => {
          toast.success("Deal created");
          onOpenChange(false);
          setForm({
            title: "",
            description: "",
            stageId: stages[0]?.id ?? "",
            contactId: defaultContactId ?? "",
            companyId: defaultCompanyId ?? "",
            ownerId: "",
            value: "",
            expectedMrr: "",
            expectedCloseDate: "",
            currency: "USD",
            priority: "medium",
          });
        },
        onError: () => toast.error("Failed to create deal"),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Contact *</Label>
            <Select
              value={form.contactId}
              onValueChange={(v) => setForm({ ...form, contactId: v, companyId: defaultCompanyId ?? "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contactsList.map(
                  (c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Company</Label>
            {defaultCompanyId ? (
              <CompanyPicker
                value={defaultCompanyId}
                onChange={() => {}}
                disabled
              />
            ) : (
              <CompanyPicker
                value={form.companyId || null}
                onChange={(id) => setForm({ ...form, companyId: id ?? "" })}
              />
            )}
            {!defaultCompanyId && contactCompanies && contactCompanies.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Contact has {contactCompanies.length} companies. Please select one.
              </p>
            )}
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>Owner</Label>
            <UserPicker
              value={form.ownerId || null}
              onChange={(userId) => setForm({ ...form, ownerId: userId ?? "" })}
              placeholder="Auto-assign to me"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stage *</Label>
              <Select
                value={form.stageId}
                onValueChange={(v) => setForm({ ...form, stageId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Expected MRR</Label>
              <Input
                type="number"
                value={form.expectedMrr}
                onChange={(e) => setForm({ ...form, expectedMrr: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm({ ...form, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expected Close</Label>
            <Input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) =>
                setForm({ ...form, expectedCloseDate: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
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
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
