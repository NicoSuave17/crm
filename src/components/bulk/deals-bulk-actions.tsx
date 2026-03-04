"use client";

import { useState } from "react";
import { ArrowRight, Tag, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useBulkStageDeal,
  useBulkTagDeals,
  useBulkDeleteDeals,
} from "@/lib/hooks/use-bulk-actions";
import { usePipelines } from "@/lib/hooks/use-pipeline";
import { useTags } from "@/lib/hooks/use-tags";
import { toast } from "sonner";

interface DealsBulkActionsProps {
  selectedIds: string[];
  onComplete: () => void;
}

interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export function DealsBulkActions({ selectedIds, onComplete }: DealsBulkActionsProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const moveStage = useBulkStageDeal();
  const addTag = useBulkTagDeals();
  const deleteBulk = useBulkDeleteDeals();

  const { data: pipelinesData } = usePipelines();
  const { data: tagsList } = useTags();

  const isPending = moveStage.isPending || addTag.isPending || deleteBulk.isPending;

  const pipelines = (pipelinesData as Pipeline[] | undefined) ?? [];

  function handleMoveToStage(stageId: string, stageName: string) {
    moveStage.mutate(
      { dealIds: selectedIds, stageId },
      {
        onSuccess: (data) => {
          toast.success(`Moved ${data.count} deals to ${stageName}`);
          setStageOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleTag(tagId: string) {
    addTag.mutate(
      { dealIds: selectedIds, tagId },
      {
        onSuccess: (data) => {
          toast.success(`Tag added to ${data.count} deals`);
          setTagOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDelete() {
    deleteBulk.mutate(
      { dealIds: selectedIds },
      {
        onSuccess: (data) => {
          toast.success(`Deleted ${data.count} deals`);
          setDeleteOpen(false);
          onComplete();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <>
      {/* Move to Stage */}
      <Popover open={stageOpen} onOpenChange={setStageOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {moveStage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Move to Stage
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Move {selectedIds.length} deals to:
          </p>
          <div className="max-h-[280px] overflow-y-auto space-y-2">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id}>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {pipeline.name}
                </p>
                <div className="space-y-0.5">
                  {pipeline.stages
                    ?.sort((a: Stage, b: Stage) => a.position - b.position)
                    .map((stage: Stage) => (
                      <button
                        key={stage.id}
                        className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                        onClick={() => handleMoveToStage(stage.id, stage.name)}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: stage.color ?? "#6B7280" }}
                        />
                        {stage.name}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            {pipelines.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">No pipelines available</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Add Tag */}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {addTag.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-2" align="start">
          <p className="text-xs text-muted-foreground mb-2 px-1">
            Add tag to {selectedIds.length} deals:
          </p>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {(tagsList as Array<{ id: string; name: string; color: string }> | undefined)?.map(
              (tag) => (
                <button
                  key={tag.id}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  onClick={() => handleTag(tag.id)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              )
            )}
            {(!tagsList || (tagsList as unknown[]).length === 0) && (
              <p className="text-xs text-muted-foreground px-2 py-1">No tags available</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => setDeleteOpen(true)}
      >
        {deleteBulk.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Delete
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} deals?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All associated activities and stage
              history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {deleteBulk.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
