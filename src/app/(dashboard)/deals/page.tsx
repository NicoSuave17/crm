"use client";

import { useState } from "react";
import { useDeals, useDeleteDeal } from "@/lib/hooks/use-deals";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { BulkActionBar } from "@/components/bulk/bulk-action-bar";
import { DealsBulkActions } from "@/components/bulk/deals-bulk-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Pencil, Search, Save, Bookmark, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { toast } from "sonner";

interface EditableDeal {
  id: string;
  title: string;
  description: string | null;
  pipelineId: string;
  stageId: string;
  contactId: string;
  companyId: string | null;
  ownerId: string;
  value: string | null;
  expectedMrr: string | null;
  expectedCloseDate: string | null;
  lostReason: string | null;
  priority: string | null;
}

interface DealRow {
  id: string;
  title: string;
  pipelineName: string;
  stageName: string;
  stageColor: string | null;
  contactId: string;
  contactFirstName: string;
  contactLastName: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  value: string | null;
  expectedCloseDate: string | null;
  priority: string | null;
}

export default function DealsPage() {
  const { data: deals, isLoading } = useDeals();
  const deleteDeal = useDeleteDeal();
  const selection = useRowSelection();
  const [editingDeal, setEditingDeal] = useState<EditableDeal | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const { data: savedViews } = useSavedViews("deal");
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  // Client-side filtering
  const filteredDeals = deals?.filter((deal: DealRow) => {
    if (search && !deal.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter !== "all" && deal.priority !== priorityFilter) return false;
    return true;
  });

  const currentPageIds = filteredDeals?.map((d: DealRow) => d.id) ?? [];

  async function handleEdit(dealId: string) {
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      if (!res.ok) throw new Error("Failed to fetch deal");
      const deal = await res.json();
      setEditingDeal(deal);
    } catch {
      toast.error("Failed to load deal for editing");
    }
  }

  function handleSaveView(e: React.FormEvent) {
    e.preventDefault();
    if (!viewName.trim()) return;
    const filters: Record<string, unknown>[] = [];
    if (search) filters.push({ field: "search", value: search });
    if (priorityFilter !== "all") filters.push({ field: "priority", value: priorityFilter });

    createView.mutate(
      { name: viewName.trim(), entityType: "deal", filters },
      {
        onSuccess: () => {
          toast.success("View saved");
          setSaveViewOpen(false);
          setViewName("");
        },
        onError: () => toast.error("Failed to save view"),
      }
    );
  }

  function handleLoadView(view: { filters: Record<string, unknown>[] }) {
    setSearch("");
    setPriorityFilter("all");
    for (const f of view.filters) {
      if (f.field === "search") setSearch(f.value as string);
      if (f.field === "priority") setPriorityFilter(f.value as string);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground">
          All deals across pipelines.
        </p>
      </div>

      {/* Saved Views */}
      {savedViews && savedViews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
          {savedViews.map((view: { id: string; name: string; filters: Record<string, unknown>[] }) => (
            <div key={view.id} className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 rounded-r-none"
                onClick={() => handleLoadView(view)}
              >
                {view.name}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-1.5 rounded-l-none border-l-0"
                onClick={() => {
                  deleteView.mutate(view.id, {
                    onSuccess: () => toast.success("View deleted"),
                    onError: () => toast.error("Failed to delete view"),
                  });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSaveViewOpen(true)}
          title="Save current filters as a view"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    selection.isAllSelected(currentPageIds)
                      ? true
                      : selection.isSomeSelected(currentPageIds)
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() => selection.toggleAll(currentPageIds)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Close Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && filteredDeals?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No deals found.
                </TableCell>
              </TableRow>
            )}

            {filteredDeals?.map((deal: DealRow) => (
                <TableRow key={deal.id} data-selected={selection.isSelected(deal.id) || undefined}>
                  <TableCell className="w-[40px]">
                    <Checkbox
                      checked={selection.isSelected(deal.id)}
                      onCheckedChange={() => selection.toggle(deal.id)}
                      aria-label={`Select ${deal.title}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{deal.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deal.pipelineName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: deal.stageColor ?? undefined,
                        color: deal.stageColor ?? undefined,
                      }}
                    >
                      {deal.stageName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contacts/${deal.contactId}`}
                      className="text-sm hover:underline"
                    >
                      {deal.contactFirstName} {deal.contactLastName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(deal.value)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deal.ownerFirstName
                      ? `${deal.ownerFirstName} ${deal.ownerLastName ?? ""}`
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString()
                      : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(deal.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteDeal.mutate(deal.id, {
                              onSuccess: () => toast.success("Deal deleted"),
                            })
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      {selection.count > 0 && (
        <BulkActionBar selectedCount={selection.count} onClear={selection.clear}>
          <DealsBulkActions
            selectedIds={Array.from(selection.selectedIds)}
            onComplete={selection.clear}
          />
        </BulkActionBar>
      )}

      {editingDeal && (
        <EditDealDialog
          deal={editingDeal}
          open={!!editingDeal}
          onOpenChange={(open) => {
            if (!open) setEditingDeal(null);
          }}
        />
      )}

      {/* Save View Dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveView} className="space-y-4">
            <Input
              placeholder="View name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createView.isPending}>
                {createView.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
