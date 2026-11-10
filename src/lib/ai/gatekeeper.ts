/**
 * Core Gatekeeper — the main AI data quality layer.
 *
 * Pipeline: Normalize → (Entity Resolution || Semantic Validation) → Score → Route
 */

import { randomUUID } from "crypto";
import { normalizeRecords, type NormalizationChange } from "./prompts/normalization";
import { resolveEntities, type EntityResolutionMatch } from "./prompts/entity-resolution";
import { validateSemantics, type SemanticIssue } from "./prompts/semantic-validation";
import {
  calculateConfidence,
  getZone,
  normalizationConfidence,
  entityResolutionConfidence,
  semanticValidationConfidence,
  type ConfidenceZone,
} from "./confidence";
import { findDuplicateContacts, findDuplicateCompanies } from "@/lib/api/duplicates";

// ─── Types ──────────────────────────────────────────────────────

export interface GatekeeperInput {
  source: "form" | "import" | "bulk" | "merge" | "api";
  operation: "create" | "update" | "merge" | "bulk_update";
  entityType: "contact" | "company" | "deal";
  data: Record<string, unknown>;
  existingRecord?: Record<string, unknown>;
  userId: string;
  bypassGatekeeper?: boolean;
  batchContext?: { jobId: string; batchIndex: number; totalBatches: number };
}

export interface FieldDecision {
  field: string;
  originalValue: unknown;
  normalizedValue: unknown;
  reason: string;
}

export interface DuplicateMatchResult {
  candidateId: string;
  isDuplicate: boolean;
  confidence: number;
  reasons: string[];
  suggestedAction: "merge" | "skip" | "review";
}

export interface GatekeeperResult {
  confidence: number;
  zone: ConfidenceZone | "bypassed";
  normalizedData: Record<string, unknown>;
  duplicateMatches: DuplicateMatchResult[];
  fieldDecisions: FieldDecision[];
  semanticIssues: SemanticIssue[];
  decisionId: string;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
}

// ─── Main Gatekeeper Function ───────────────────────────────────

export async function gatekeeperAnalyze(
  input: GatekeeperInput
): Promise<GatekeeperResult> {
  const decisionId = randomUUID();
  const startTime = Date.now();

  // Admin bypass
  if (input.bypassGatekeeper) {
    return {
      confidence: 100,
      zone: "bypassed",
      normalizedData: input.data,
      duplicateMatches: [],
      fieldDecisions: [],
      semanticIssues: [],
      decisionId,
      modelUsed: "none",
      tokensUsed: 0,
      latencyMs: 0,
    };
  }

  // Check if OPENROUTER_API_KEY is configured — if not, pass through
  if (!process.env.OPENROUTER_API_KEY) {
    return {
      confidence: 100,
      zone: "auto_apply",
      normalizedData: input.data,
      duplicateMatches: [],
      fieldDecisions: [],
      semanticIssues: [],
      decisionId,
      modelUsed: "none",
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  let totalTokens = 0;
  const models: string[] = [];

  // ── Step 1: Normalization ──
  let normalizedData = { ...input.data };
  const fieldDecisions: FieldDecision[] = [];

  try {
    const normResult = await normalizeRecords(
      [{ index: 0, fields: input.data }],
      input.entityType
    );

    totalTokens += normResult.tokensUsed;
    if (normResult.model !== "none") models.push(normResult.model);

    if (normResult.records.length > 0) {
      const rec = normResult.records[0];
      normalizedData = { ...normalizedData, ...rec.normalized };

      for (const change of rec.changes) {
        fieldDecisions.push({
          field: change.field,
          originalValue: input.data[change.field],
          normalizedValue: rec.normalized[change.field],
          reason: change.reason,
        });
      }
    }
  } catch (error) {
    console.error("Gatekeeper normalization error:", error);
    // Continue without normalization — don't block the pipeline
  }

  // ── Step 2: Entity Resolution + Semantic Validation (parallel) ──
  let duplicateMatches: DuplicateMatchResult[] = [];
  let semanticIssues: SemanticIssue[] = [];
  let erConfidence = 100;
  let svConfidence = 100;

  const [erResult, svResult] = await Promise.allSettled([
    // Entity Resolution
    (async () => {
      if (input.operation === "update" && !input.existingRecord) return null;

      // First, query DB for candidates
      const candidates = await findDbCandidates(input.entityType, normalizedData, input.existingRecord?.id as string | undefined);

      if (candidates.length === 0) return null;

      // Then, ask LLM for judgment
      const result = await resolveEntities({
        newRecord: normalizedData,
        candidates: candidates.map((c) => ({
          id: c.id,
          fields: c.fields,
          matchReason: c.matchReason,
          matchConfidence: c.confidence,
        })),
        entityType: input.entityType,
      });

      totalTokens += result.tokensUsed;
      if (result.model !== "none") models.push(result.model);

      return result.matches;
    })(),
    // Semantic Validation
    (async () => {
      const result = await validateSemantics({
        records: [{ index: 0, fields: normalizedData }],
        entityType: input.entityType,
        context: input.operation === "update" ? "This is an update to an existing record." : undefined,
      });

      totalTokens += result.tokensUsed;
      if (result.model !== "none") models.push(result.model);

      return { issues: result.issues, quality: result.overallQuality };
    })(),
  ]);

  if (erResult.status === "fulfilled" && erResult.value) {
    duplicateMatches = erResult.value;
    const hasDuplicates = duplicateMatches.some((m) => m.isDuplicate);
    const bestConfidence = hasDuplicates
      ? Math.max(...duplicateMatches.filter((m) => m.isDuplicate).map((m) => m.confidence))
      : undefined;
    erConfidence = entityResolutionConfidence(hasDuplicates, bestConfidence);
  }

  if (svResult.status === "fulfilled" && svResult.value) {
    semanticIssues = svResult.value.issues;
    svConfidence = semanticValidationConfidence(semanticIssues);
  }

  // ── Step 3: Calculate confidence & route ──
  const normConfidence = normalizationConfidence(
    Object.keys(input.data).length,
    fieldDecisions.length,
    false
  );

  const confidence = calculateConfidence({
    normalization: normConfidence,
    entityResolution: erConfidence,
    semanticValidation: svConfidence,
  });

  const zone = getZone(confidence);
  const latencyMs = Date.now() - startTime;

  return {
    confidence,
    zone,
    normalizedData,
    duplicateMatches,
    fieldDecisions,
    semanticIssues,
    decisionId,
    modelUsed: [...new Set(models)].join(", ") || "none",
    tokensUsed: totalTokens,
    latencyMs,
  };
}

// ─── DB Candidate Lookup ────────────────────────────────────────

interface DbCandidate {
  id: string;
  fields: Record<string, unknown>;
  matchReason: string;
  confidence: number;
}

export async function findDbCandidates(
  entityType: "contact" | "company" | "deal",
  data: Record<string, unknown>,
  excludeId?: string
): Promise<DbCandidate[]> {
  if (entityType === "contact") {
    const matches = await findDuplicateContacts({
      email: data.email as string | undefined,
      phone: data.phone as string | undefined,
      firstName: data.firstName as string || "",
      lastName: data.lastName as string | undefined,
      excludeId,
    });

    return matches.map((m) => ({
      id: m.record.id,
      fields: m.record as unknown as Record<string, unknown>,
      matchReason: m.matchReason,
      confidence: m.confidence,
    }));
  }

  if (entityType === "company") {
    const name = data.name as string;
    if (!name) return [];

    const matches = await findDuplicateCompanies({
      name,
      domain: data.domain as string | undefined,
      excludeId,
    });

    return matches.map((m) => ({
      id: m.record.id,
      fields: m.record as unknown as Record<string, unknown>,
      matchReason: m.matchReason,
      confidence: m.confidence,
    }));
  }

  // Deals don't have duplicate detection currently
  return [];
}
