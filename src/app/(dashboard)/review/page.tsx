"use client";

import { Card } from "@/components/ui/card";
import { ReviewQueueTable } from "@/components/review/review-queue-table";
import { useGatekeeperStats } from "@/lib/hooks/use-review-queue";
import { Shield, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function ReviewQueuePage() {
  const { data: stats } = useGatekeeperStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Review Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Records flagged by the AI Gatekeeper for human review
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Pending
          </div>
          <div className="text-2xl font-bold mt-1">{stats?.queueDepth ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Approved Today
          </div>
          <div className="text-2xl font-bold mt-1">{stats?.approvedToday ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 text-red-500" />
            Rejected Today
          </div>
          <div className="text-2xl font-bold mt-1">{stats?.rejectedToday ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-blue-500" />
            Auto-Apply Rate
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats?.autoApplyRate !== undefined ? `${stats.autoApplyRate}%` : "—"}
          </div>
        </Card>
      </div>

      {/* Queue Table */}
      <ReviewQueueTable />
    </div>
  );
}
