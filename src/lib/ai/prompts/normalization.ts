/**
 * Chain 1: Field normalization via LLM.
 * Normalizes phone numbers, emails, names, URLs, company names.
 */

import { callOpenRouter } from "../openrouter";

const SYSTEM_PROMPT = `You are a data normalization engine for a CRM system. Your job is to clean and standardize contact/company data fields.

Rules:
- **Phone**: Format to E.164 if possible (e.g., "+14155551234"). If no country code, assume US (+1). Remove spaces, dashes, parens.
- **Email**: Lowercase, trim whitespace. Flag obviously invalid emails (e.g., missing @, ".con" typo).
- **Names**: Title case (e.g., "john smith" → "John Smith"). Fix ALL-CAPS. Don't change cultural names you're unsure about.
- **URLs**: Ensure https:// prefix. Normalize LinkedIn to "https://linkedin.com/in/{handle}". Remove trailing slashes.
- **Company names**: Standardize common suffixes (Inc., LLC, Ltd.). Remove extra whitespace.
- **Domain**: Extract domain from full URLs. Lowercase. Remove www. prefix.

For each record, return the normalized version plus a list of changes you made.

Respond with JSON: { "records": [{ "index": number, "normalized": {...fields}, "changes": [{ "field": string, "from": string, "to": string, "reason": string }] }] }

If a field is already correct, don't include it in changes. If a field is empty/null, skip it.`;

export interface NormalizationInput {
  index: number;
  fields: Record<string, unknown>;
}

export interface NormalizationChange {
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface NormalizationResult {
  index: number;
  normalized: Record<string, unknown>;
  changes: NormalizationChange[];
}

export interface NormalizationOutput {
  records: NormalizationResult[];
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

/**
 * Normalize a batch of records (up to ~30 at a time for cost efficiency).
 */
export async function normalizeRecords(
  records: NormalizationInput[],
  entityType: "contact" | "company" | "deal"
): Promise<NormalizationOutput> {
  if (records.length === 0) {
    return { records: [], tokensUsed: 0, latencyMs: 0, model: "none" };
  }

  const userPrompt = `Entity type: ${entityType}
Records to normalize:
${JSON.stringify(records, null, 2)}`;

  const response = await callOpenRouter<{ records: NormalizationResult[] }>(
    { tier: "fast", temperature: 0, maxTokens: 4096 },
    SYSTEM_PROMPT,
    userPrompt
  );

  return {
    records: response.data.records || [],
    tokensUsed: response.tokensUsed,
    latencyMs: response.latencyMs,
    model: response.model,
  };
}
