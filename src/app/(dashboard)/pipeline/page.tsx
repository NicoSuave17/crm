"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePipelines, usePipelineWithDeals } from "@/lib/hooks/use-pipeline";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { DealForm } from "@/components/pipeline/deal-form";
import { OwnerFilter, type OwnerFilterValue } from "@/components/filters/owner-filter";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

export default function PipelinePageWrapper() {
  return (
    <Suspense>
      <PipelinePage />
    </Suspense>
  );
}

function PipelinePage() {
  const searchParams = useSearchParams();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [dealFormOpen, setDealFormOpen] = useState(false);

  const { user: currentUser, isAdminOrManager } = useCurrentUser();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>("all");
  const ownerFilterInitialized = useRef(false);
  useEffect(() => {
    if (currentUser && !ownerFilterInitialized.current) {
      ownerFilterInitialized.current = true;
      if (!isAdminOrManager) {
        setOwnerFilter("my");
      }
    }
  }, [currentUser, isAdminOrManager]);

  // Handle ?create=true from command palette quick action
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setDealFormOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Auto-select first pipeline
  const activePipelineId =
    selectedPipelineId || (pipelines?.[0]?.id ?? "");

  const { data: pipelineData, isLoading: pipelineLoading } =
    usePipelineWithDeals(activePipelineId);

  const filteredDeals = useMemo(() => {
    const allDeals = pipelineData?.deals ?? [];
    if (ownerFilter === "all") return allDeals;
    if (ownerFilter === "unassigned") return allDeals.filter((d: { ownerId: string | null }) => !d.ownerId);
    if (ownerFilter === "my" && currentUser?.id) return allDeals.filter((d: { ownerId: string | null }) => d.ownerId === currentUser.id);
    return allDeals;
  }, [pipelineData?.deals, ownerFilter, currentUser?.id]);

  if (pipelinesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Manage your deals across stages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pipelines && pipelines.length > 1 && (
            <Select
              value={activePipelineId}
              onValueChange={setSelectedPipelineId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(
                  (p: { id: string; name: string }) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          )}
          <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} />
          <Button
            onClick={() => setDealFormOpen(true)}
            disabled={!pipelineData?.stages?.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      {pipelineLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      ) : pipelineData ? (
        <KanbanBoard
          stages={pipelineData.stages ?? []}
          deals={filteredDeals}
        />
      ) : (
        <p className="text-muted-foreground text-center py-20">
          No pipelines found.
        </p>
      )}

      {pipelineData?.stages && (
        <DealForm
          open={dealFormOpen}
          onOpenChange={setDealFormOpen}
          pipelineId={activePipelineId}
          stages={pipelineData.stages}
        />
      )}
    </div>
  );
}
