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
import { ContactPicker } from "@/components/pickers/contact-picker";
import { DealPicker } from "@/components/pickers/deal-picker";
import { useCreateTask, useUpdateTask } from "@/lib/hooks/use-tasks";
import { toast } from "sonner";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task";

interface TaskFormDialogProps {
  /** When provided, the dialog operates in edit mode with pre-filled values. */
  task?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigneeId: string;
    contactId: string | null;
    dealId: string | null;
    dueDate: string | null;
  } | null;
  /** Pre-fill contactId when creating from a contact detail tab (Phase 6). */
  defaultContactId?: string;
  /** Pre-fill dealId when creating from a deal detail tab (future). */
  defaultDealId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string | undefined;
  contactId: string | null;
  dealId: string | null;
}

export function TaskFormDialog({
  task,
  defaultContactId,
  defaultDealId,
  open,
  onOpenChange,
}: TaskFormDialogProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const isEdit = !!task;

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    dueDate: "",
    assigneeId: undefined,
    contactId: null,
    dealId: null,
  });

  useEffect(() => {
    if (open) {
      if (task) {
        // Edit mode: populate from task
        setForm({
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate
            ? new Date(task.dueDate).toISOString().split("T")[0]
            : "",
          assigneeId: task.assigneeId,
          contactId: task.contactId ?? null,
          dealId: task.dealId ?? null,
        });
      } else {
        // Create mode: reset to defaults
        setForm({
          title: "",
          description: "",
          status: "pending",
          priority: "medium",
          dueDate: "",
          assigneeId: undefined,
          contactId: defaultContactId ?? null,
          dealId: defaultDealId ?? null,
        });
      }
    }
  }, [open, task, defaultContactId, defaultDealId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isEdit) {
      const data: UpdateTaskInput = {
        title: form.title,
        description: form.description || undefined,
        status: form.status as UpdateTaskInput["status"],
        priority: form.priority as UpdateTaskInput["priority"],
        assigneeId: form.assigneeId || undefined,
        contactId: form.contactId || null,
        dealId: form.dealId || null,
        dueDate: form.dueDate
          ? new Date(form.dueDate).toISOString()
          : null,
      };

      updateTask.mutate(
        { id: task!.id, data },
        {
          onSuccess: () => {
            toast.success("Task updated");
            onOpenChange(false);
          },
          onError: (error) => toast.error(error.message),
        }
      );
    } else {
      const data: CreateTaskInput = {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority as CreateTaskInput["priority"],
        assigneeId: form.assigneeId || undefined,
        contactId: form.contactId || undefined,
        dealId: form.dealId || undefined,
        dueDate: form.dueDate
          ? new Date(form.dueDate).toISOString()
          : undefined,
      };

      createTask.mutate(data, {
        onSuccess: () => {
          toast.success("Task created");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create task"),
      });
    }
  }

  const isPending = isEdit ? updateTask.isPending : createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Task title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          {/* Status + Priority */}
          {isEdit ? (
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
          ) : (
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
          )}

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="task-dueDate">Due Date</Label>
            <Input
              id="task-dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee</Label>
            <UserPicker
              value={form.assigneeId ?? null}
              onChange={(userId) =>
                setForm((prev) => ({
                  ...prev,
                  assigneeId: userId ?? undefined,
                }))
              }
              placeholder="Select assignee..."
            />
          </div>

          {/* Contact + Deal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact</Label>
              <ContactPicker
                value={form.contactId}
                onChange={(contactId) =>
                  setForm((prev) => ({ ...prev, contactId }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Deal</Label>
              <DealPicker
                value={form.dealId}
                onChange={(dealId) =>
                  setForm((prev) => ({ ...prev, dealId }))
                }
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
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
