"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StageChecklistEditor } from "@/components/settings/stage-checklist-editor";

export interface StageData {
  id: string;
  name: string;
  color: string | null;
  probability: number | null;
  isWon: boolean;
  isLost: boolean;
}

interface SortableStageRowProps {
  stage: StageData;
  pipelineId: string;
  onEdit: (stage: StageData) => void;
  onDelete: (stageId: string) => void;
}

export function SortableStageRow({
  stage,
  onEdit,
  onDelete,
}: SortableStageRowProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-0">
      <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: stage.color ?? "#8A7E7D" }}
        />
        <span className="text-sm font-medium flex-1">{stage.name}</span>
        {stage.probability != null && (
          <span className="text-xs text-muted-foreground">
            {stage.probability}%
          </span>
        )}
        {stage.isWon && (
          <Badge
            variant="default"
            className="bg-[#00876D] hover:bg-[#00876D] text-xs"
          >
            Won
          </Badge>
        )}
        {stage.isLost && (
          <Badge variant="destructive" className="text-xs">
            Lost
          </Badge>
        )}
        <button
          onClick={() => setChecklistOpen(!checklistOpen)}
          className={`text-muted-foreground hover:text-foreground ${checklistOpen ? "text-primary" : ""}`}
          title="Manage checklist"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEdit(stage)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(stage.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {checklistOpen && (
        <div className="ml-8 border-l-2 border-muted pl-4 py-2">
          <StageChecklistEditor stageId={stage.id} stageName={stage.name} />
        </div>
      )}
    </div>
  );
}
