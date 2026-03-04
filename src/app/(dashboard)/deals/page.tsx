"use client";

import { useState } from "react";
import { useDeals, useDeleteDeal } from "@/lib/hooks/use-deals";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Pencil } from "lucide-react";
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

export default function DealsPage() {
  const { data: deals, isLoading } = useDeals();
  const deleteDeal = useDeleteDeal();
  const [editingDeal, setEditingDeal] = useState<EditableDeal | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground">
          All deals across pipelines.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && deals?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No deals yet. Create one from the Pipeline view.
                </TableCell>
              </TableRow>
            )}

            {deals?.map(
              (deal: {
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
              }) => (
                <TableRow key={deal.id}>
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
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString()
                      : "—"}
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

      {editingDeal && (
        <EditDealDialog
          deal={editingDeal}
          open={!!editingDeal}
          onOpenChange={(open) => {
            if (!open) setEditingDeal(null);
          }}
        />
      )}
    </div>
  );
}
