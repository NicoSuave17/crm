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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateStage, useUpdateStage } from "@/lib/hooks/use-pipeline";
import { toast } from "sonner";

const STAGE_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#1F2937",
];

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stage?: {
    id: string;
    name: string;
    color: string | null;
    probability: number | null;
    isWon: boolean;
    isLost: boolean;
  } | null;
}

export function StageDialog({
  open,
  onOpenChange,
  pipelineId,
  stage,
}: StageDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [probability, setProbability] = useState("");
  const [isWon, setIsWon] = useState(false);
  const [isLost, setIsLost] = useState(false);

  const createStage = useCreateStage();
  const updateStage = useUpdateStage();

  const isEditing = !!stage;
  const isPending = createStage.isPending || updateStage.isPending;

  useEffect(() => {
    if (open && stage) {
      setName(stage.name);
      setColor(stage.color ?? "#3B82F6");
      setProbability(stage.probability != null ? String(stage.probability) : "");
      setIsWon(stage.isWon);
      setIsLost(stage.isLost);
    } else if (open) {
      setName("");
      setColor("#3B82F6");
      setProbability("");
      setIsWon(false);
      setIsLost(false);
    }
  }, [open, stage]);

  function handleWonChange(checked: boolean) {
    setIsWon(checked);
    if (checked) {
      setIsLost(false);
      setProbability("100");
    }
  }

  function handleLostChange(checked: boolean) {
    setIsLost(checked);
    if (checked) {
      setIsWon(false);
      setProbability("0");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      color,
      probability: probability !== "" ? Number(probability) : null,
      isWon,
      isLost,
    };

    if (isEditing) {
      updateStage.mutate(
        { pipelineId, stageId: stage.id, data },
        {
          onSuccess: () => {
            toast.success("Stage updated");
            onOpenChange(false);
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      createStage.mutate(
        { pipelineId, data },
        {
          onSuccess: () => {
            toast.success("Stage created");
            onOpenChange(false);
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Stage" : "Add Stage"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Name</Label>
            <Input
              id="stage-name"
              placeholder="e.g. Qualified"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-full border shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex gap-2 flex-wrap flex-1">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 ${
                      color === c
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <Input
              placeholder="#hex"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-2 w-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-probability">Probability (%)</Label>
            <Input
              id="stage-probability"
              type="number"
              min={0}
              max={100}
              placeholder="0-100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="stage-won"
                checked={isWon}
                onCheckedChange={(checked) =>
                  handleWonChange(checked === true)
                }
              />
              <Label htmlFor="stage-won" className="text-sm font-normal">
                Mark as Won
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stage-lost"
                checked={isLost}
                onCheckedChange={(checked) =>
                  handleLostChange(checked === true)
                }
              />
              <Label htmlFor="stage-lost" className="text-sm font-normal">
                Mark as Lost
              </Label>
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
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Stage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
