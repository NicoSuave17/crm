"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface ChangeHistoryTabProps {
  entityType: string;
  entityId: string;
}

interface ChangeRecord {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  changedAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  type: "Type",
  status: "Status",
  tier: "Tier",
  healthScore: "Health Score",
  currentMrr: "MRR",
  currentGmv: "GMV",
  churnRisk: "Churn Risk",
  ownerId: "Owner",
  vertical: "Vertical",
  name: "Name",
  domain: "Domain",
  industry: "Industry",
  size: "Size",
  title: "Title",
  description: "Description",
  value: "Value",
  priority: "Priority",
  stageId: "Stage",
  expectedCloseDate: "Expected Close Date",
};

export function ChangeHistoryTab({ entityType, entityId }: ChangeHistoryTabProps) {
  const { data: history, isLoading } = useQuery<ChangeRecord[]>({
    queryKey: ["changeHistory", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/change-history?entityType=${entityType}&entityId=${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No change history recorded yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Old Value</TableHead>
            <TableHead>New Value</TableHead>
            <TableHead>Changed By</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((change) => (
            <TableRow key={change.id}>
              <TableCell className="font-medium text-sm">
                {FIELD_LABELS[change.fieldName] ?? change.fieldName}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {change.oldValue || <span className="italic">empty</span>}
              </TableCell>
              <TableCell className="text-sm">
                {change.newValue || <span className="italic text-muted-foreground">empty</span>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {change.userFirstName
                  ? `${change.userFirstName} ${change.userLastName ?? ""}`
                  : "System"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(change.changedAt), "MMM d, yyyy h:mm a")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
