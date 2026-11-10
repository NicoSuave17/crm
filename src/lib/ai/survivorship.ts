/**
 * Survivorship Rules Engine
 *
 * Determines which field value "wins" when merging or updating records.
 * Strategies: most_recent, most_complete, manual, ai_decide
 */

import { db } from "@/lib/db";
import { gatekeeperSurvivorshipRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type SurvivorshipStrategy = "most_recent" | "most_complete" | "manual" | "ai_decide";

interface SurvivorshipRule {
  field: string;
  strategy: SurvivorshipStrategy;
  aiContext: string | null;
  priority: number;
}

interface ResolvedField {
  field: string;
  winner: "existing" | "incoming";
  value: unknown;
  reason: string;
}

interface SurvivorshipResult {
  resolved: Record<string, unknown>;
  needsReview: { field: string; existingValue: unknown; incomingValue: unknown }[];
  needsAiDecision: { field: string; existingValue: unknown; incomingValue: unknown; context: string }[];
  decisions: ResolvedField[];
}

/**
 * Load survivorship rules from DB for an entity type.
 * Falls back to defaults if no rules configured.
 */
async function loadRules(entityType: "contact" | "company" | "deal"): Promise<SurvivorshipRule[]> {
  const rules = await db
    .select()
    .from(gatekeeperSurvivorshipRules)
    .where(eq(gatekeeperSurvivorshipRules.entityType, entityType));

  if (rules.length > 0) {
    return rules.map((r) => ({
      field: r.field,
      strategy: r.strategy as SurvivorshipStrategy,
      aiContext: r.aiContext,
      priority: r.priority,
    }));
  }

  // Default rules
  return getDefaultRules(entityType);
}

function getDefaultRules(entityType: "contact" | "company" | "deal"): SurvivorshipRule[] {
  if (entityType === "contact") {
    return [
      { field: "email", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "phone", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "firstName", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "lastName", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "linkedinUrl", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "twitterUrl", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "websiteUrl", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "type", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "status", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "tier", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "healthScore", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "currentMrr", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "currentGmv", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "ownerId", strategy: "manual", aiContext: null, priority: 0 },
    ];
  }

  if (entityType === "company") {
    return [
      { field: "name", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "domain", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "industry", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "size", strategy: "most_recent", aiContext: null, priority: 0 },
      { field: "description", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "linkedinUrl", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "websiteUrl", strategy: "most_complete", aiContext: null, priority: 0 },
      { field: "ownerId", strategy: "manual", aiContext: null, priority: 0 },
    ];
  }

  // deal defaults
  return [
    { field: "title", strategy: "most_complete", aiContext: null, priority: 0 },
    { field: "description", strategy: "most_complete", aiContext: null, priority: 0 },
    { field: "value", strategy: "most_recent", aiContext: null, priority: 0 },
    { field: "priority", strategy: "most_recent", aiContext: null, priority: 0 },
  ];
}

/**
 * Apply survivorship rules to resolve field conflicts between existing and incoming records.
 */
export async function applySurvivorshipRules(
  entityType: "contact" | "company" | "deal",
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  existingUpdatedAt?: Date,
  incomingUpdatedAt?: Date
): Promise<SurvivorshipResult> {
  const rules = await loadRules(entityType);
  const ruleMap = new Map(rules.map((r) => [r.field, r]));

  const resolved: Record<string, unknown> = {};
  const needsReview: SurvivorshipResult["needsReview"] = [];
  const needsAiDecision: SurvivorshipResult["needsAiDecision"] = [];
  const decisions: ResolvedField[] = [];

  // Only process fields that have conflicts (both have values and they differ)
  const allFields = new Set([...Object.keys(existing), ...Object.keys(incoming)]);

  for (const field of allFields) {
    // Skip system fields
    if (["id", "crmId", "createdAt", "updatedAt"].includes(field)) continue;

    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // If incoming doesn't have the field, keep existing
    if (incomingVal === undefined || incomingVal === null || incomingVal === "") {
      resolved[field] = existingVal;
      continue;
    }

    // If existing doesn't have the field, use incoming
    if (existingVal === undefined || existingVal === null || existingVal === "") {
      resolved[field] = incomingVal;
      decisions.push({ field, winner: "incoming", value: incomingVal, reason: "Existing value was empty" });
      continue;
    }

    // Both have values — apply strategy
    if (String(existingVal) === String(incomingVal)) {
      resolved[field] = existingVal;
      continue;
    }

    const rule = ruleMap.get(field);
    const strategy = rule?.strategy || "most_complete";

    switch (strategy) {
      case "most_recent": {
        const existingTime = existingUpdatedAt?.getTime() || 0;
        const incomingTime = incomingUpdatedAt?.getTime() || Date.now();
        const winner = incomingTime >= existingTime ? "incoming" : "existing";
        resolved[field] = winner === "incoming" ? incomingVal : existingVal;
        decisions.push({ field, winner, value: resolved[field], reason: "Most recent value wins" });
        break;
      }

      case "most_complete": {
        const existingLen = String(existingVal).length;
        const incomingLen = String(incomingVal).length;
        const winner = incomingLen >= existingLen ? "incoming" : "existing";
        resolved[field] = winner === "incoming" ? incomingVal : existingVal;
        decisions.push({ field, winner, value: resolved[field], reason: "Most complete (longer) value wins" });
        break;
      }

      case "manual":
        needsReview.push({ field, existingValue: existingVal, incomingValue: incomingVal });
        resolved[field] = existingVal; // Default to existing until reviewed
        break;

      case "ai_decide":
        needsAiDecision.push({
          field,
          existingValue: existingVal,
          incomingValue: incomingVal,
          context: rule?.aiContext || "",
        });
        resolved[field] = existingVal; // Default to existing until AI decides
        break;
    }
  }

  return { resolved, needsReview, needsAiDecision, decisions };
}
