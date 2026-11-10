/**
 * Batch processor for import pipeline.
 * Groups rows into batches of ~30, runs through gatekeeper pipeline.
 */

import { gatekeeperAnalyze, type GatekeeperResult } from "./gatekeeper";
import { db } from "@/lib/db";
import { gatekeeperDecisionLog, gatekeeperReviewQueue } from "@/lib/db/schema";

const BATCH_SIZE = 30;

interface BatchRow {
  index: number;
  data: Record<string, unknown>;
}

interface BatchResult {
  autoApply: { index: number; data: Record<string, unknown>; decisionId: string }[];
  review: { index: number; data: Record<string, unknown>; decisionId: string }[];
  reject: { index: number; data: Record<string, unknown>; decisionId: string; issues: string[] }[];
  totalTokens: number;
  totalLatencyMs: number;
}

/**
 * Process an import batch through the gatekeeper pipeline.
 */
export async function processImportBatch(
  rows: BatchRow[],
  entityType: "contact" | "company" | "deal",
  jobId: string,
  userId: string
): Promise<BatchResult> {
  const result: BatchResult = {
    autoApply: [],
    review: [],
    reject: [],
    totalTokens: 0,
    totalLatencyMs: 0,
  };

  // Split into batches
  const batches: BatchRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // Process each row through gatekeeper
    // Note: normalization could be batched, but entity resolution needs per-row DB lookups
    const gkResults = await Promise.allSettled(
      batch.map((row) =>
        gatekeeperAnalyze({
          source: "import",
          operation: "create",
          entityType,
          data: row.data,
          userId,
          batchContext: {
            jobId,
            batchIndex: batchIdx,
            totalBatches: batches.length,
          },
        })
      )
    );

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const gkResult = gkResults[i];

      if (gkResult.status === "rejected") {
        // Gatekeeper error — treat as reject
        result.reject.push({
          index: row.index,
          data: row.data,
          decisionId: "error",
          issues: [gkResult.reason instanceof Error ? gkResult.reason.message : "Gatekeeper analysis failed"],
        });
        continue;
      }

      const gk = gkResult.value;
      result.totalTokens += gk.tokensUsed;
      result.totalLatencyMs += gk.latencyMs;

      // Log decision
      try {
        await db.insert(gatekeeperDecisionLog).values({
          decisionId: gk.decisionId,
          source: "import",
          operation: "create",
          entityType,
          confidence: String(gk.confidence),
          zone: gk.zone === "bypassed" ? "auto_apply" : gk.zone,
          analysis: {
            fieldDecisions: gk.fieldDecisions,
            duplicateMatches: gk.duplicateMatches,
            semanticIssues: gk.semanticIssues,
          },
          modelUsed: gk.modelUsed,
          tokensUsed: gk.tokensUsed,
          latencyMs: gk.latencyMs,
          userId,
          importJobId: jobId,
        });
      } catch {
        // Non-critical — continue even if logging fails
      }

      // Route based on zone
      switch (gk.zone) {
        case "auto_apply":
        case "bypassed":
          result.autoApply.push({
            index: row.index,
            data: gk.normalizedData,
            decisionId: gk.decisionId,
          });
          break;

        case "review":
          result.review.push({
            index: row.index,
            data: gk.normalizedData,
            decisionId: gk.decisionId,
          });

          // Add to review queue
          try {
            await db.insert(gatekeeperReviewQueue).values({
              decisionId: gk.decisionId,
              source: "import",
              operation: "create",
              entityType,
              incomingData: row.data,
              normalizedData: gk.normalizedData,
              aiAnalysis: {
                confidence: gk.confidence,
                fieldDecisions: gk.fieldDecisions,
                duplicateMatches: gk.duplicateMatches,
                semanticIssues: gk.semanticIssues,
              },
              submittedBy: userId,
              importJobId: jobId,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
          } catch {
            // Non-critical
          }
          break;

        case "reject":
          result.reject.push({
            index: row.index,
            data: row.data,
            decisionId: gk.decisionId,
            issues: gk.semanticIssues.map((i) => i.message),
          });
          break;
      }
    }
  }

  return result;
}
