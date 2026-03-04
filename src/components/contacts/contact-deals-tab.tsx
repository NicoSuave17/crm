"use client";

import { useState } from "react";
import { useDeals } from "@/lib/hooks/use-deals";
import { usePipelines, usePipelineWithDeals } from "@/lib/hooks/use-pipeline";
import { DealForm } from "@/components/pipeline/deal-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils/format";
import { format } from "date-fns";
import Link from "next/link";
import { Plus } from "lucide-react";

const priorityColors: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  urgent: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface ContactDealsTabProps {
  contactId: string;
}

export function ContactDealsTab({ contactId }: ContactDealsTabProps) {
  const { data: deals, isLoading } = useDeals({ contactId });
  const { data: pipelines } = usePipelines();
  const [createOpen, setCreateOpen] = useState(false);

  // Use the first pipeline as default for deal creation
  const defaultPipeline = pipelines?.[0];
  const { data: pipelineData } = usePipelineWithDeals(
    defaultPipeline?.id ?? ""
  );
  const stages = pipelineData?.stages ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Deals</CardTitle>
          <CardDescription>
            Active and closed deals for this contact
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!defaultPipeline}
          title={
            !defaultPipeline
              ? "Create a pipeline first to add deals"
              : undefined
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Deal
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Expected Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && (!deals || deals.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No deals for this contact.
                </TableCell>
              </TableRow>
            )}

            {deals?.map(
              (deal: {
                id: string;
                title: string;
                stageName: string;
                stageColor: string | null;
                value: string | null;
                priority: string | null;
                expectedCloseDate: string | null;
              }) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="hover:underline"
                    >
                      {deal.title}
                    </Link>
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
                  <TableCell className="font-medium">
                    {formatCurrency(deal.value)}
                  </TableCell>
                  <TableCell>
                    {deal.priority ? (
                      <Badge
                        variant={priorityColors[deal.priority] ?? "outline"}
                      >
                        {deal.priority}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {deal.expectedCloseDate
                      ? format(new Date(deal.expectedCloseDate), "MMM d, yyyy")
                      : "--"}
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </CardContent>

      {defaultPipeline && (
        <DealForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          pipelineId={defaultPipeline.id}
          stages={stages}
          defaultContactId={contactId}
        />
      )}
    </Card>
  );
}
