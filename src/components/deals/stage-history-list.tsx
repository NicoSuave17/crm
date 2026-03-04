"use client";

import { useStageHistory } from "@/lib/hooks/use-deals";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CircleDot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StageHistoryEntry {
  id: string;
  dealId: string;
  fromStageId: string | null;
  toStageId: string;
  fromStageName: string | null;
  fromStageColor: string | null;
  toStageName: string | null;
  toStageColor: string | null;
  userId: string | null;
  changedAt: string;
}

interface StageHistoryListProps {
  dealId: string;
}

export function StageHistoryList({ dealId }: StageHistoryListProps) {
  const { data: history, isLoading } = useStageHistory(dealId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No stage changes recorded.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />

      <div className="space-y-6">
        {(history as StageHistoryEntry[]).map((entry) => {
          const isCreation = !entry.fromStageId;

          return (
            <div key={entry.id} className="relative flex gap-4 pl-0">
              {/* Dot on the timeline */}
              <div
                className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background"
              >
                <CircleDot
                  className="h-4 w-4"
                  style={{ color: entry.toStageColor ?? "#6B7280" }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isCreation ? (
                    <span className="text-sm">
                      Created in{" "}
                      <span
                        className="font-medium"
                        style={{ color: entry.toStageColor ?? undefined }}
                      >
                        {entry.toStageName ?? "Unknown"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm flex items-center gap-1.5">
                      <span
                        className="font-medium"
                        style={{ color: entry.fromStageColor ?? undefined }}
                      >
                        {entry.fromStageName ?? "Unknown"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span
                        className="font-medium"
                        style={{ color: entry.toStageColor ?? undefined }}
                      >
                        {entry.toStageName ?? "Unknown"}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(entry.changedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
