/**
 * Route helper for integrating gatekeeper with API routes.
 * Provides a consistent pattern for all entry points.
 */

import { NextResponse } from "next/server";
import { gatekeeperAnalyze, type GatekeeperResult } from "./gatekeeper";
import { db } from "@/lib/db";
import { gatekeeperDecisionLog, gatekeeperReviewQueue } from "@/lib/db/schema";

interface GatekeeperRouteOptions {
  source: "form" | "import" | "bulk" | "merge" | "api";
  operation: "create" | "update" | "merge" | "bulk_update";
  entityType: "contact" | "company" | "deal";
  data: Record<string, unknown>;
  existingRecord?: Record<string, unknown>;
  userId: string;
  bypassGatekeeper?: boolean;
}

/**
 * Run gatekeeper analysis and return:
 * - { proceed: true, data: normalizedData } for auto_apply/bypassed
 * - A NextResponse for review (202) or reject (422)
 */
export async function gatekeeperCheck(
  options: GatekeeperRouteOptions
): Promise<
  | { proceed: true; data: Record<string, unknown>; result: GatekeeperResult }
  | { proceed: false; response: NextResponse }
> {
  try {
    const result = await gatekeeperAnalyze({
      source: options.source,
      operation: options.operation,
      entityType: options.entityType,
      data: options.data,
      existingRecord: options.existingRecord,
      userId: options.userId,
      bypassGatekeeper: options.bypassGatekeeper,
    });

    // Log decision
    try {
      await db.insert(gatekeeperDecisionLog).values({
        decisionId: result.decisionId,
        source: options.source,
        operation: options.operation,
        entityType: options.entityType,
        confidence: String(result.confidence),
        zone: result.zone === "bypassed" ? "auto_apply" : result.zone,
        analysis: {
          fieldDecisions: result.fieldDecisions,
          duplicateMatches: result.duplicateMatches,
          semanticIssues: result.semanticIssues,
        },
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        userId: options.userId,
      });
    } catch {
      // Non-critical
    }

    if (result.zone === "auto_apply" || result.zone === "bypassed") {
      return { proceed: true, data: result.normalizedData, result };
    }

    if (result.zone === "review") {
      // Add to review queue
      try {
        const dataForReview = { ...options.data };
        // For updates, include entity ID so it can be applied later
        if (options.operation === "update" && options.existingRecord?.id) {
          (result.normalizedData as Record<string, unknown>)._entityId = options.existingRecord.id;
        }

        await db.insert(gatekeeperReviewQueue).values({
          decisionId: result.decisionId,
          source: options.source,
          operation: options.operation,
          entityType: options.entityType,
          incomingData: dataForReview,
          normalizedData: result.normalizedData,
          existingRecord: options.existingRecord || null,
          aiAnalysis: {
            confidence: result.confidence,
            fieldDecisions: result.fieldDecisions,
            duplicateMatches: result.duplicateMatches,
            semanticIssues: result.semanticIssues,
          },
          submittedBy: options.userId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      } catch {
        // If queue insert fails, auto-apply instead
        return { proceed: true, data: result.normalizedData, result };
      }

      return {
        proceed: false,
        response: NextResponse.json(
          {
            status: "pending_review",
            decisionId: result.decisionId,
            confidence: result.confidence,
            issues: result.semanticIssues,
            duplicates: result.duplicateMatches,
            message: "Record submitted for review due to data quality concerns",
          },
          { status: 202 }
        ),
      };
    }

    // Reject
    return {
      proceed: false,
      response: NextResponse.json(
        {
          error: "Data quality check failed",
          decisionId: result.decisionId,
          confidence: result.confidence,
          issues: result.semanticIssues,
          duplicates: result.duplicateMatches,
        },
        { status: 422 }
      ),
    };
  } catch (error) {
    // If gatekeeper fails entirely, allow the request through (fail-open)
    console.error("Gatekeeper check failed, allowing through:", error);
    return { proceed: true, data: options.data, result: null as unknown as GatekeeperResult };
  }
}
