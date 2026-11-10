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
import { CompanyPicker } from "@/components/pickers/company-picker";
import { ContactPicker } from "@/components/pickers/contact-picker";
import { UserPicker } from "@/components/pickers/user-picker";
import { useUpdateDeal } from "@/lib/hooks/use-deals";
import { usePipelineWithDeals } from "@/lib/hooks/use-pipeline";
import { toast } from "sonner";

interface EditDealDialogProps {
  deal: {
    id: string;
    title: string;
    description: string | null;
    pipelineId: string;
    stageId: string;
    contactId: string;
    companyId: string | null;
    ownerId: string;
    value: string | null;
    expectedMrr: string | null;
    expectedCloseDate: string | null;
    lostReason: string | null;
    priority: string | null;
    currency: string | null;
    actualCloseDate: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isWon: boolean | null;
  isLost: boolean | null;
  probability: number | null;
}

interface FormState {
  title: string;
  stageId: string;
  contactId: string;
  companyId: string | null;
  ownerId: string;
  priority: string;
  value: string;
  expectedMrr: string;
  expectedCloseDate: string;
  actualCloseDate: string;
  currency: string;
  description: string;
  lostReason: string;
}

export function EditDealDialog({
  deal,
  open,
  onOpenChange,
}: EditDealDialogProps) {
  const updateDeal = useUpdateDeal();
  const { data: pipelineData } = usePipelineWithDeals(deal.pipelineId);

  const stages: Stage[] = pipelineData?.stages ?? [];

  const [form, setForm] = useState<FormState>({
    title: deal.title,
    stageId: deal.stageId,
    contactId: deal.contactId,
    companyId: deal.companyId,
    ownerId: deal.ownerId,
    priority: deal.priority ?? "medium",
    value: deal.value ?? "",
    expectedMrr: deal.expectedMrr ?? "",
    expectedCloseDate: deal.expectedCloseDate ?? "",
    actualCloseDate: deal.actualCloseDate ?? "",
    currency: deal.currency ?? "USD",
    description: deal.description ?? "",
    lostReason: deal.lostReason ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: deal.title,
        stageId: deal.stageId,
        contactId: deal.contactId,
        companyId: deal.companyId,
        ownerId: deal.ownerId,
        priority: deal.priority ?? "medium",
        value: deal.value ?? "",
        expectedMrr: deal.expectedMrr ?? "",
        expectedCloseDate: deal.expectedCloseDate ?? "",
        actualCloseDate: deal.actualCloseDate ?? "",
        currency: deal.currency ?? "USD",
        description: deal.description ?? "",
        lostReason: deal.lostReason ?? "",
      });
    }
  }, [deal, open]);

  // Determine if selected stage is a lost stage
  const selectedStage = stages.find((s) => s.id === form.stageId);
  const isLostStage = selectedStage?.isLost === true;

  // Clear lostReason when switching away from a lost stage
  useEffect(() => {
    if (!isLostStage) {
      setForm((prev) => ({ ...prev, lostReason: "" }));
    }
  }, [isLostStage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: Record<string, unknown> = {
      title: form.title,
      stageId: form.stageId,
      contactId: form.contactId,
      companyId: form.companyId || null,
      ownerId: form.ownerId,
      priority: form.priority,
      value: form.value || undefined,
      expectedMrr: form.expectedMrr || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
      actualCloseDate: form.actualCloseDate || null,
      currency: form.currency || undefined,
      description: form.description || undefined,
      lostReason: isLostStage ? form.lostReason || null : null,
    };

    updateDeal.mutate(
      { id: deal.id, data },
      {
        onSuccess: () => {
          toast.success("Deal updated");
          onOpenChange(false);
        },
        onError: (error) => {
          const err = error as Error & { code?: string; items?: { id: string; title: string }[] };
          if (err.code === "CHECKLIST_INCOMPLETE" && err.items?.length) {
            const itemNames = err.items.map((i) => i.title).join(", ");
            toast.error(
              `Cannot change stage: complete required checklist items first: ${itemNames}`,
              { duration: 6000 }
            );
          } else {
            toast.error(error.message);
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-deal-title">Title *</Label>
            <Input
              id="edit-deal-title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </div>

          {/* Stage + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={form.stageId}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, stageId: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: stage.color ?? "#8A7E7D" }}
                        />
                        {stage.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, priority: v }))
                }
              >
                <SelectTrigger className="w-full">
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

          {/* Contact + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact</Label>
              <ContactPicker
                value={form.contactId}
                onChange={(contactId) =>
                  setForm((prev) => ({
                    ...prev,
                    contactId: contactId ?? prev.contactId,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <CompanyPicker
                value={form.companyId}
                onChange={(companyId) =>
                  setForm((prev) => ({ ...prev, companyId }))
                }
              />
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>Owner</Label>
            <UserPicker
              value={form.ownerId || null}
              onChange={(userId) =>
                setForm((prev) => ({
                  ...prev,
                  ownerId: userId ?? prev.ownerId,
                }))
              }
            />
          </div>

          {/* Value + Expected MRR */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-deal-value">Value</Label>
              <Input
                id="edit-deal-value"
                value={form.value}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, value: e.target.value }))
                }
                placeholder="e.g. 10000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-mrr">Expected MRR</Label>
              <Input
                id="edit-deal-mrr"
                value={form.expectedMrr}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expectedMrr: e.target.value }))
                }
                placeholder="e.g. 1000"
              />
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, currency: v }))
              }
            >
              <SelectTrigger className="w-full">
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

          {/* Close Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-deal-closeDate">Expected Close</Label>
              <Input
                id="edit-deal-closeDate"
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    expectedCloseDate: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-actualClose">Actual Close</Label>
              <Input
                id="edit-deal-actualClose"
                type="date"
                value={form.actualCloseDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    actualCloseDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-deal-description">Description</Label>
            <Textarea
              id="edit-deal-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* Lost Reason - conditional */}
          {isLostStage && (
            <div className="space-y-2">
              <Label htmlFor="edit-deal-lostReason">Lost Reason</Label>
              <Textarea
                id="edit-deal-lostReason"
                value={form.lostReason}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lostReason: e.target.value,
                  }))
                }
                rows={2}
                placeholder="Why was this deal lost?"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateDeal.isPending}>
              {updateDeal.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
