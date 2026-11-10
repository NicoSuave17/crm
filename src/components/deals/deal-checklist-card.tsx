"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDealChecklist, useToggleChecklistItem } from "@/lib/hooks/use-checklists";
import { ListChecks } from "lucide-react";

interface DealChecklistCardProps {
  dealId: string;
}

export function DealChecklistCard({ dealId }: DealChecklistCardProps) {
  const { data: items, isLoading } = useDealChecklist(dealId);
  const toggle = useToggleChecklistItem();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) return null;

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Checklist
          </div>
          <span className="text-xs text-muted-foreground font-normal">
            {completed}/{total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted mb-3">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <label
              key={item.checklistId}
              className="flex items-start gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={item.completed}
                onCheckedChange={(checked) => {
                  toggle.mutate({
                    dealId,
                    checklistId: item.checklistId,
                    completed: !!checked,
                  });
                }}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm ${
                    item.completed
                      ? "text-muted-foreground line-through"
                      : ""
                  }`}
                >
                  {item.title}
                </span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
