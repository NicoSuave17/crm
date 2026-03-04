"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  useDeletePipeline,
  useDeleteStage,
  useReorderStages,
} from "@/lib/hooks/use-pipeline";
import { toast } from "sonner";
import {
  SortableStageRow,
  type StageData,
} from "@/components/settings/sortable-stage-row";
import { PipelineDialog } from "@/components/settings/pipeline-dialog";
import { StageDialog } from "@/components/settings/stage-dialog";

const TYPE_LABELS: Record<string, string> = {
  seller_onboarding: "Seller Onboarding",
  enterprise: "Enterprise",
  partnerships: "Partnerships",
  custom: "Custom",
};

interface PipelineCardProps {
  pipeline: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    isDefault: boolean;
    stages: Array<{
      id: string;
      name: string;
      position: number;
      color: string | null;
      probability: number | null;
      isWon: boolean;
      isLost: boolean;
    }>;
  };
}

export function PipelineCard({ pipeline }: PipelineCardProps) {
  const [editPipelineOpen, setEditPipelineOpen] = useState(false);
  const [deletePipelineOpen, setDeletePipelineOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<StageData | null>(null);
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

  const deletePipeline = useDeletePipeline();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedStages = [...(pipeline.stages ?? [])].sort(
    (a, b) => a.position - b.position
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedStages.findIndex((s) => s.id === active.id);
    const newIndex = sortedStages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sortedStages, oldIndex, newIndex);
    const stageIds = reordered.map((s) => s.id);

    reorderStages.mutate(
      { pipelineId: pipeline.id, stageIds },
      {
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDeletePipeline() {
    deletePipeline.mutate(pipeline.id, {
      onSuccess: () => {
        toast.success("Pipeline deleted");
        setDeletePipelineOpen(false);
      },
      onError: (err) => {
        if (err.message.toLowerCase().includes("deal")) {
          toast.error(
            "Cannot delete pipeline with existing deals — move or delete deals first."
          );
        } else {
          toast.error(err.message);
        }
        setDeletePipelineOpen(false);
      },
    });
  }

  function handleDeleteStage(stageId: string) {
    deleteStage.mutate(
      { pipelineId: pipeline.id, stageId },
      {
        onSuccess: () => {
          toast.success("Stage deleted");
          setDeleteStageId(null);
        },
        onError: (err) => {
          if (err.message.toLowerCase().includes("deal")) {
            toast.error(
              "Cannot delete stage with existing deals — move or delete deals first."
            );
          } else {
            toast.error(err.message);
          }
          setDeleteStageId(null);
        },
      }
    );
  }

  function handleEditStage(stage: StageData) {
    setEditingStage(stage);
    setStageDialogOpen(true);
  }

  function handleAddStage() {
    setEditingStage(null);
    setStageDialogOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{pipeline.name}</h3>
              <Badge variant="outline">
                {TYPE_LABELS[pipeline.type] ?? pipeline.type}
              </Badge>
              {pipeline.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
            {pipeline.description && (
              <p className="text-sm text-muted-foreground">
                {pipeline.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditPipelineOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeletePipelineOpen(true)}
              disabled={pipeline.isDefault}
              title={
                pipeline.isDefault
                  ? "Cannot delete the default pipeline"
                  : "Delete pipeline"
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Stages
            </h4>
            <Button variant="outline" size="sm" onClick={handleAddStage}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Stage
            </Button>
          </div>

          {sortedStages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No stages yet. Add one to get started.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedStages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {sortedStages.map((stage) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      pipelineId={pipeline.id}
                      onEdit={handleEditStage}
                      onDelete={(id) => setDeleteStageId(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Edit Pipeline Dialog */}
      <PipelineDialog
        open={editPipelineOpen}
        onOpenChange={setEditPipelineOpen}
        pipeline={pipeline}
      />

      {/* Delete Pipeline Confirmation */}
      <AlertDialog open={deletePipelineOpen} onOpenChange={setDeletePipelineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{pipeline.name}&rdquo;?
              This action cannot be undone. All stages in this pipeline will
              also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeletePipeline}
            >
              {deletePipeline.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Create/Edit Dialog */}
      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        pipelineId={pipeline.id}
        stage={editingStage}
      />

      {/* Delete Stage Confirmation */}
      <AlertDialog
        open={!!deleteStageId}
        onOpenChange={(open) => {
          if (!open) setDeleteStageId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stage? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteStageId) handleDeleteStage(deleteStageId);
              }}
            >
              {deleteStage.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
