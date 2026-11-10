"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DealCard } from "./deal-card";
import { formatCurrencyTotals } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  crmId: string;
  title: string;
  value: string | null;
  currency?: string | null;
  priority: string | null;
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

interface KanbanColumnProps {
  stage: {
    id: string;
    name: string;
    color: string | null;
  };
  deals: Deal[];
}

export function KanbanColumn({ stage, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalDisplay = formatCurrencyTotals(
    deals.map((d) => ({ value: d.value, currency: d.currency }))
  );

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 pb-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: stage.color ?? "#8A7E7D" }}
        />
        <h3 className="text-sm font-medium">{stage.name}</h3>
        <span className="text-xs text-muted-foreground">({deals.length})</span>
        {totalDisplay && (
          <span className="text-xs text-muted-foreground ml-auto">
            {totalDisplay}
          </span>
        )}
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg bg-muted/30 p-2 min-h-[200px] transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary/20"
        )}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No deals
          </p>
        )}
      </div>
    </div>
  );
}
