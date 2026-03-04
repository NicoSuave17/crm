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
import { useCreateDeal } from "@/lib/hooks/use-deals";
import { useContacts } from "@/lib/hooks/use-contacts";
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
  const { data: contactsData } = useContacts({ limit: 100 });
  const [form, setForm] = useState({
    title: "",
    description: "",
    stageId: stages[0]?.id ?? "",
    contactId: defaultContactId ?? "",
    value: "",
    expectedCloseDate: "",
    priority: "medium" as string,
  });

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
        companyId: defaultCompanyId || undefined,
        value: form.value || undefined,
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
            value: "",
            expectedCloseDate: "",
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
              onValueChange={(v) => setForm({ ...form, contactId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contactsData?.data?.map(
                  (c: { id: string; firstName: string; lastName: string | null }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Value ($)</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
              />
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
