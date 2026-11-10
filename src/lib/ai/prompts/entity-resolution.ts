/**
 * Chain 2: AI-powered entity resolution.
 * Uses DB lookup + LLM judgment to determine if records are duplicates.
 */

import { callOpenRouter } from "../openrouter";

const SYSTEM_PROMPT = `You are an entity resolution engine for a CRM. Given a new record and a list of potential matches from the database, determine which (if any) are true duplicates.

Consider:
- **Email match**: Very high confidence indicator — same email almost always means same person/company.
- **Phone match**: High confidence, but shared phones exist (reception desk, family).
- **Name similarity**: Moderate — "John Smith" is common. Combined with company/domain it's stronger.
- **LinkedIn URL**: Very high confidence — unique identifier per person.
- **Domain match**: Very high confidence for companies.
- **Context clues**: Same company + similar name = likely same person. Different companies = likely different people.

For each candidate, return:
- isDuplicate: boolean
- confidence: number (0-100)
- reasons: string[] (explain your reasoning)
- suggestedAction: "merge" | "skip" | "review" (merge if very confident, review if uncertain, skip if not a duplicate)

Respond with JSON: { "matches": [{ "candidateId": string, "isDuplicate": boolean, "confidence": number, "reasons": string[], "suggestedAction": "merge" | "skip" | "review" }] }

Be conservative — when in doubt, suggest "review" rather than auto-merging.`;

export interface EntityResolutionCandidate {
  id: string;
  fields: Record<string, unknown>;
  matchReason: string;
  matchConfidence: number;
}

export interface EntityResolutionInput {
  newRecord: Record<string, unknown>;
  candidates: EntityResolutionCandidate[];
  entityType: "contact" | "company" | "deal";
}

export interface EntityResolutionMatch {
  candidateId: string;
  isDuplicate: boolean;
  confidence: number;
  reasons: string[];
  suggestedAction: "merge" | "skip" | "review";
}

export interface EntityResolutionOutput {
  matches: EntityResolutionMatch[];
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

/**
 * Resolve whether a new record matches any existing candidates.
 */
export async function resolveEntities(
  input: EntityResolutionInput
): Promise<EntityResolutionOutput> {
  if (input.candidates.length === 0) {
    return { matches: [], tokensUsed: 0, latencyMs: 0, model: "none" };
  }

  const userPrompt = `Entity type: ${input.entityType}

New record being added:
${JSON.stringify(input.newRecord, null, 2)}

Existing candidates from database:
${JSON.stringify(input.candidates.map(c => ({
  id: c.id,
  ...c.fields,
  _matchReason: c.matchReason,
  _dbConfidence: c.matchConfidence,
})), null, 2)}`;

  const response = await callOpenRouter<{ matches: EntityResolutionMatch[] }>(
    { tier: "standard", temperature: 0, maxTokens: 2048 },
    SYSTEM_PROMPT,
    userPrompt
  );

  return {
    matches: response.data.matches || [],
    tokensUsed: response.tokensUsed,
    latencyMs: response.latencyMs,
    model: response.model,
  };
}
