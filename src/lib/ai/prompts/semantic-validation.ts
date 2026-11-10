/**
 * Chain 3: Semantic validation via LLM.
 * Catches swapped fields, implausible values, inconsistent enums, test data.
 */

import { callOpenRouter } from "../openrouter";

const SYSTEM_PROMPT = `You are a semantic data validation engine for a CRM system. Review incoming records for data quality issues that schema validation alone cannot catch.

Check for:
1. **Swapped fields**: Email in phone field, name in email field, URL in name field, etc.
2. **Implausible values**: Phone numbers that are too short/long, future birth dates, negative revenue.
3. **Test/junk data**: "test", "asdf", "xxx", "John Doe" placeholder data, obviously fake emails.
4. **Inconsistent enums**: Status "active" on a contact with no activity, "enterprise" tier with zero revenue.
5. **Missing context**: An enterprise deal with no company, a contact with LinkedIn but no name.
6. **Cross-row issues** (for batches): Same phone number on different people, all emails from same domain but different companies.

For each issue found, return:
- field: which field has the issue
- severity: "error" (block), "warning" (review), "info" (note)
- message: human-readable description
- suggestion: optional fix suggestion

Respond with JSON: { "issues": [{ "field": string, "severity": "error" | "warning" | "info", "message": string, "suggestion": string | null }], "overallQuality": "good" | "needs_review" | "poor" }

Be practical — don't flag minor style issues. Focus on data integrity problems.`;

export interface SemanticValidationInput {
  records: { index: number; fields: Record<string, unknown> }[];
  entityType: "contact" | "company" | "deal";
  context?: string;
}

export interface SemanticIssue {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string | null;
  recordIndex?: number;
}

export interface SemanticValidationOutput {
  issues: SemanticIssue[];
  overallQuality: "good" | "needs_review" | "poor";
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

/**
 * Validate a batch of records for semantic issues.
 */
export async function validateSemantics(
  input: SemanticValidationInput
): Promise<SemanticValidationOutput> {
  if (input.records.length === 0) {
    return { issues: [], overallQuality: "good", tokensUsed: 0, latencyMs: 0, model: "none" };
  }

  const userPrompt = `Entity type: ${input.entityType}
${input.context ? `Context: ${input.context}\n` : ""}
Records to validate:
${JSON.stringify(input.records, null, 2)}`;

  const response = await callOpenRouter<{
    issues: SemanticIssue[];
    overallQuality: "good" | "needs_review" | "poor";
  }>(
    { tier: "standard", temperature: 0, maxTokens: 2048 },
    SYSTEM_PROMPT,
    userPrompt
  );

  return {
    issues: response.data.issues || [],
    overallQuality: response.data.overallQuality || "good",
    tokensUsed: response.tokensUsed,
    latencyMs: response.latencyMs,
    model: response.model,
  };
}
