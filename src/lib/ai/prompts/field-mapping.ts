/**
 * AI-powered CSV field mapping.
 * Replaces alias-based autoMapColumnsForFields() with semantic understanding.
 * Returns both category (contact/company/skip) and specific CRM field mapping.
 */

import { callOpenRouter } from "../openrouter";

const SYSTEM_PROMPT = `You are a CSV field mapping engine for a CRM system. Given CSV headers, sample data rows, and available CRM fields, determine:

1. **Category**: Is each column a Contact field, Company field, or should it be Skipped?
2. **CRM Field**: Which specific CRM field does it map to?

Consider:
- Column names in any language (e.g., "Nom" → firstName, "Telefon" → phone, "Organisation" → company name)
- Abbreviations ("Mob" → phone, "LI" → linkedinUrl, "Co." → company name)
- Contextual clues from sample data (column with "@" = email, "+1" prefix = phone, "linkedin.com" = linkedinUrl)
- "Mobile", "Cell", "Mob" → phone (all phone numbers map to the phone field)
- Company-related data (industry, company size, company domain, company LinkedIn) → category "company"
- Person-related data (first name, email, personal LinkedIn, mobile) → category "contact"
- Internal IDs, row numbers, or irrelevant columns → category "skip"
- Custom fields: if a CSV column doesn't match any standard CRM field but seems relevant, suggest it with the closest match

For each CSV header, return:
- category: "contact" | "company" | "skip"
- crmField: the CRM field key to map to, or null if skip or no match
- confidence: 0-100
- reason: brief explanation

Respond with JSON: { "mappings": [{ "csvHeader": string, "category": "contact" | "company" | "skip", "crmField": string | null, "confidence": number, "reason": string }] }`;

export interface FieldMappingInput {
  headers: string[];
  sampleRows: string[][];
  entityType: "contact" | "company";
  crmFields: { key: string; label: string; type: string; group?: string }[];
  customFields?: { key: string; label: string; type: string }[];
}

export interface FieldMappingResult {
  csvHeader: string;
  category: "contact" | "company" | "skip";
  crmField: string | null;
  confidence: number;
  reason: string;
}

export interface FieldMappingOutput {
  mappings: FieldMappingResult[];
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

/**
 * Map CSV headers to CRM fields using AI.
 */
export async function mapFields(input: FieldMappingInput): Promise<FieldMappingOutput> {
  if (input.headers.length === 0) {
    return { mappings: [], tokensUsed: 0, latencyMs: 0, model: "none" };
  }

  const userPrompt = `Entity type: ${input.entityType}

CSV headers: ${JSON.stringify(input.headers)}

Sample data (first ${input.sampleRows.length} rows):
${input.sampleRows.map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n")}

Available CRM fields (with group indicating contact vs company):
${input.crmFields.map((f) => `- ${f.key} (${f.label}, type: ${f.type}${f.group ? `, group: ${f.group}` : ""})`).join("\n")}
${input.customFields?.length ? `\nCustom fields:\n${input.customFields.map((f) => `- ${f.key} (${f.label}, type: ${f.type})`).join("\n")}` : ""}`;

  const response = await callOpenRouter<{ mappings: FieldMappingResult[] }>(
    { tier: "standard", temperature: 0, maxTokens: 2048 },
    SYSTEM_PROMPT,
    userPrompt
  );

  return {
    mappings: response.data.mappings || [],
    tokensUsed: response.tokensUsed,
    latencyMs: response.latencyMs,
    model: response.model,
  };
}
