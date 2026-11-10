"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { FieldDiffViewer } from "./field-diff-viewer";
import { useReviewDecision } from "@/lib/hooks/use-review-queue";
import { toast } from "sonner";

interface ReviewDetailPanelProps {
  review: {
    id: string;
    decisionId: string;
    source: string;
    operation: string;
    entityType: string;
    incomingData: Record<string, unknown>;
    normalizedData: Record<string, unknown> | null;
    existingRecord: Record<string, unknown> | null;
    aiAnalysis: {
      confidence: number;
      fieldDecisions?: { field: string; originalValue: unknown; normalizedValue: unknown; reason: string }[];
      duplicateMatches?: { candidateId: string; isDuplicate: boolean; confidence: number; reasons: string[] }[];
      semanticIssues?: { field: string; severity: string; message: string; suggestion: string | null }[];
    } | null;
    status: string;
    createdAt: string;
  };
  onClose?: () => void;
}

export function ReviewDetailPanel({ review, onClose }: ReviewDetailPanelProps) {
  const [notes, setNotes] = useState("");
  const reviewDecision = useReviewDecision();

  const analysis = review.aiAnalysis;
  const isPending = review.status === "pending_review";

  const handleDecision = async (action: "approve" | "reject") => {
    try {
      await reviewDecision.mutateAsync({
        reviewId: review.id,
        action,
        notes: notes || undefined,
      });
      toast.success(action === "approve" ? "Record approved and created" : "Record rejected");
      onClose?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit decision");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{review.entityType}</Badge>
          <Badge variant="secondary">{review.operation}</Badge>
          <Badge variant="secondary">{review.source}</Badge>
        </div>
        {analysis && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Confidence:</span>
            <span
              className={
                analysis.confidence >= 90
                  ? "text-green-600"
                  : analysis.confidence >= 70
                  ? "text-amber-600"
                  : "text-red-600"
              }
            >
              {analysis.confidence}%
            </span>
          </div>
        )}
      </div>

      {/* Field Diff */}
      <Card className="p-3">
        <h4 className="text-sm font-medium mb-2">Field Comparison</h4>
        <FieldDiffViewer
          incomingData={review.incomingData}
          existingRecord={review.existingRecord}
          normalizedData={review.normalizedData}
          fieldDecisions={analysis?.fieldDecisions}
        />
      </Card>

      {/* Semantic Issues */}
      {analysis?.semanticIssues && analysis.semanticIssues.length > 0 && (
        <Card className="p-3">
          <h4 className="text-sm font-medium mb-2">Data Quality Issues</h4>
          <div className="space-y-1.5">
            {analysis.semanticIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {issue.severity === "error" ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium">{issue.field}:</span> {issue.message}
                  {issue.suggestion && (
                    <span className="text-muted-foreground ml-1">({issue.suggestion})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Duplicate Matches */}
      {analysis?.duplicateMatches && analysis.duplicateMatches.length > 0 && (
        <Card className="p-3">
          <h4 className="text-sm font-medium mb-2">Potential Duplicates</h4>
          <div className="space-y-1.5">
            {analysis.duplicateMatches.map((match, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={match.isDuplicate ? "destructive" : "secondary"} className="text-[10px]">
                    {match.isDuplicate ? "Duplicate" : "Not duplicate"}
                  </Badge>
                  <span>{match.confidence}% confident</span>
                </div>
                <ul className="ml-4 mt-0.5 text-muted-foreground list-disc">
                  {match.reasons.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Review notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => handleDecision("approve")}
              disabled={reviewDecision.isPending}
              className="flex-1"
              size="sm"
            >
              {reviewDecision.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
            <Button
              onClick={() => handleDecision("reject")}
              disabled={reviewDecision.isPending}
              variant="destructive"
              className="flex-1"
              size="sm"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
