"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreatePipeline,
  useUpdatePipeline,
} from "@/lib/hooks/use-pipeline";
import { toast } from "sonner";

const PIPELINE_TYPES = [
  { value: "seller_onboarding", label: "Seller Onboarding" },
  { value: "enterprise", label: "Enterprise" },
  { value: "partnerships", label: "Partnerships" },
  { value: "custom", label: "Custom" },
];

interface PipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: {
    id: string;
    name: string;
    description: string | null;
    type: string;
  } | null;
}

export function PipelineDialog({
  open,
  onOpenChange,
  pipeline,
}: PipelineDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("custom");

  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();

  const isEditing = !!pipeline;
  const isPending = createPipeline.isPending || updatePipeline.isPending;

  useEffect(() => {
    if (open && pipeline) {
      setName(pipeline.name);
      setDescription(pipeline.description ?? "");
      setType(pipeline.type);
    } else if (open) {
      setName("");
      setDescription("");
      setType("custom");
    }
  }, [open, pipeline]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
    };

    if (isEditing) {
      updatePipeline.mutate(
        { id: pipeline.id, data },
        {
          onSuccess: () => {
            toast.success("Pipeline updated");
            onOpenChange(false);
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      createPipeline.mutate(data, {
        onSuccess: () => {
          toast.success("Pipeline created");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Pipeline" : "Create Pipeline"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Name</Label>
            <Input
              id="pipeline-name"
              placeholder="e.g. Enterprise Sales"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeline-description">Description</Label>
            <Textarea
              id="pipeline-description"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeline-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="pipeline-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
