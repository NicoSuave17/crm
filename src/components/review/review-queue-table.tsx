"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ReviewDetailPanel } from "./review-detail-panel";
import { useReviewQueue } from "@/lib/hooks/use-review-queue";

interface ReviewQueueTableProps {
  importJobId?: string;
}

export function ReviewQueueTable({ importJobId }: ReviewQueueTableProps) {
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useReviewQueue({
    status: statusFilter,
    entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
    importJobId,
    page,
    limit: 25,
  });

  const items = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_review">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="contact">Contact</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="deal">Deal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Entity</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No review items found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: Record<string, unknown>) => {
                const isExpanded = expandedId === item.id;
                const analysis = item.aiAnalysis as Record<string, unknown> | null;
                const confidence = analysis?.confidence as number | undefined;
                const incoming = item.incomingData as Record<string, unknown>;

                // Build a display name from the data
                const displayName =
                  incoming?.firstName
                    ? `${incoming.firstName} ${incoming.lastName || ""}`
                    : incoming?.name || incoming?.title || `${item.entityType} record`;

                return (
                  <>
                    <TableRow
                      key={String(item.id)}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : String(item.id))}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{String(displayName).trim()}</div>
                          <div className="text-xs text-muted-foreground">{String(item.entityType)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {String(item.operation)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{String(item.source)}</TableCell>
                      <TableCell>
                        {confidence !== undefined && (
                          <span
                            className={
                              confidence >= 90
                                ? "text-green-600 text-sm font-medium"
                                : confidence >= 70
                                ? "text-amber-600 text-sm font-medium"
                                : "text-red-600 text-sm font-medium"
                            }
                          >
                            {confidence}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "approved"
                              ? "default"
                              : item.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {String(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(String(item.createdAt)).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${item.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <ReviewDetailPanel
                            review={item as Parameters<typeof ReviewDetailPanel>[0]["review"]}
                            onClose={() => setExpandedId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination.total} items total
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
