"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { KanbanColumn } from "./kanban-column";
import { DealCard } from "./deal-card";
import { useMoveDeal } from "@/lib/hooks/use-pipeline";
import { toast } from "sonner";

interface Deal {
  id: string;
  crmId: string;
  title: string;
  value: string | null;
  currency?: string | null;
  priority: string | null;
  stageId: string;
  contactFirstName: string;
  contactLastName: string | null;
  contactAvatarUrl: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt?: string;
  checklistProgress?: { completed: number; total: number } | null;
}

interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

interface KanbanBoardProps {
  stages: Stage[];
  deals: Deal[];
}

export function KanbanBoard({ stages, deals }: KanbanBoardProps) {
  const moveDeal = useMoveDeal();
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  // Track local stage overrides during drag for instant visual feedback
  const [localStageOverrides, setLocalStageOverrides] = useState<
    Record<string, string>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId) ?? null
    : null;

  // Compute effective deals with local overrides applied
  const effectiveDeals = deals.map((d) =>
    localStageOverrides[d.id]
      ? { ...d, stageId: localStageOverrides[d.id] }
      : d
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return;

      // Determine which stage we're over
      let targetStageId: string;
      const isStage = stages.some((s) => s.id === over.id);
      if (isStage) {
        targetStageId = over.id as string;
      } else {
        const overDeal = deals.find((d) => d.id === over.id);
        if (!overDeal) return;
        targetStageId =
          localStageOverrides[overDeal.id] ?? overDeal.stageId;
      }

      const currentStageId = localStageOverrides[dealId] ?? deal.stageId;
      if (currentStageId !== targetStageId) {
        setLocalStageOverrides((prev) => ({
          ...prev,
          [dealId]: targetStageId,
        }));
      }
    },
    [deals, stages, localStageOverrides]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDealId(null);

      const dealId = active.id as string;
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) {
        setLocalStageOverrides({});
        return;
      }

      // Use the local override if present (from dragOver), otherwise resolve from drop target
      let targetStageId = localStageOverrides[dealId];
      if (!targetStageId && over) {
        const isStage = stages.some((s) => s.id === over.id);
        if (isStage) {
          targetStageId = over.id as string;
        } else {
          const overDeal = deals.find((d) => d.id === over.id);
          if (overDeal) targetStageId = overDeal.stageId;
        }
      }

      // Clear local overrides
      setLocalStageOverrides({});

      if (!targetStageId || deal.stageId === targetStageId) return;

      moveDeal.mutate(
        { dealId, stageId: targetStageId },
        {
          onError: (error) => {
            const err = error as Error & { code?: string; items?: { id: string; title: string }[] };
            if (err.code === "CHECKLIST_INCOMPLETE" && err.items?.length) {
              const itemNames = err.items.map((i) => i.title).join(", ");
              toast.error(
                `Cannot move deal: complete required checklist items first: ${itemNames}`,
                { duration: 6000 }
              );
            } else {
              toast.error(err.message || "Failed to move deal");
            }
          },
        }
      );
    },
    [deals, stages, localStageOverrides, moveDeal]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDealId(null);
    setLocalStageOverrides({});
  }, []);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={effectiveDeals.filter((d) => d.stageId === stage.id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeDeal ? (
          <div className="rotate-[2deg] scale-105 opacity-90">
            <DealCard deal={activeDeal} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
