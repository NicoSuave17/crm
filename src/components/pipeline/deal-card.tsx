"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, getInitials } from "@/lib/utils/format";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DealCardProps {
  deal: {
    id: string;
    crmId: string;
    title: string;
    value: string | null;
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
  };
  isOverlay?: boolean;
}

function getDaysInStage(updatedAt?: string, createdAt?: string): number {
  const ref = updatedAt || createdAt;
  if (!ref) return 0;
  return Math.floor(
    (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getAgingColor(days: number): string {
  if (days <= 7) return "text-[#00876D]"; // viridian (green)
  if (days <= 14) return "text-[#DBF505]"; // lemon lime (yellow)
  if (days <= 30) return "text-[#FA4616]"; // dragon fire (orange)
  return "text-[#E86644]"; // burnt sienna (red)
}

function getAgingDotColor(days: number): string {
  if (days <= 7) return "bg-[#00876D]";
  if (days <= 14) return "bg-[#DBF505]";
  if (days <= 30) return "bg-[#FA4616]";
  return "bg-[#E86644]";
}

import { PRIORITY_COLORS } from "@/lib/constants/brand-colors";

const priorityColors = PRIORITY_COLORS;

export function DealCard({ deal, isOverlay }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : "opacity-100"
      }`}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-medium leading-tight">{deal.title}</p>
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">{deal.crmId}</span>
        </div>

        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={deal.contactAvatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {getInitials(deal.contactFirstName, deal.contactLastName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {deal.contactFirstName} {deal.contactLastName}
          </span>
        </div>

        <div className="flex items-center justify-between">
          {deal.value && (
            <span className="text-sm font-semibold">
              {formatCurrency(deal.value)}
            </span>
          )}
          {deal.priority && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[deal.priority] ?? ""}`}>
              {deal.priority}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          {deal.expectedCloseDate && (
            <p className="text-xs text-muted-foreground">
              Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}
            </p>
          )}
          {(() => {
            const days = getDaysInStage(deal.updatedAt, deal.createdAt);
            return (
              <span className={cn("flex items-center gap-1 text-[10px]", getAgingColor(days))}>
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", getAgingDotColor(days))} />
                {days}d
              </span>
            );
          })()}
        </div>

        {deal.checklistProgress && deal.checklistProgress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.round(
                    (deal.checklistProgress.completed /
                      deal.checklistProgress.total) *
                      100
                  )}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {deal.checklistProgress.completed}/{deal.checklistProgress.total}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
