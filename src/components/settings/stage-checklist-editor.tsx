"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useStageChecklists,
  useCreateChecklist,
  useDeleteChecklist,
} from "@/lib/hooks/use-checklists";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface StageChecklistEditorProps {
  stageId: string;
  stageName: string;
}

export function StageChecklistEditor({
  stageId,
  stageName,
}: StageChecklistEditorProps) {
  const { data: items = [], isLoading } = useStageChecklists(stageId);
  const createChecklist = useCreateChecklist();
  const deleteChecklist = useDeleteChecklist();
  const [newTitle, setNewTitle] = useState("");
  const [newRequired, setNewRequired] = useState(false);

  function handleAdd() {
    if (!newTitle.trim()) return;
    createChecklist.mutate(
      { stageId, title: newTitle.trim(), isRequired: newRequired },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewRequired(false);
          toast.success("Checklist item added");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDelete(checklistId: string) {
    deleteChecklist.mutate(
      { stageId, checklistId },
      {
        onSuccess: () => toast.success("Checklist item removed"),
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        Checklist for &ldquo;{stageName}&rdquo;
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="truncate">
                {item.title}
                {item.isRequired && (
                  <span className="ml-1.5 text-[10px] font-medium text-destructive">
                    (required)
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(item.id)}
                disabled={deleteChecklist.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No checklist items yet.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add checklist item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!newTitle.trim() || createChecklist.isPending}
            className="shrink-0"
          >
            {createChecklist.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {newTitle.trim() && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={newRequired}
              onCheckedChange={(checked) => setNewRequired(checked === true)}
              className="h-3.5 w-3.5"
            />
            Required to exit stage
          </label>
        )}
      </div>
    </div>
  );
}
