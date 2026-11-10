import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { mapFields, type FieldMappingInput } from "@/lib/ai/prompts/field-mapping";
import {
  CONTACT_IMPORT_FIELDS,
  COMPANY_IMPORT_FIELDS,
  autoMapColumnsForFields,
  customFieldsToImportFields,
} from "@/lib/utils/csv-mapping";
import { z } from "zod";

const mapFieldsSchema = z.object({
  headers: z.array(z.string()),
  sampleRows: z.array(z.array(z.string())),
  entityType: z.enum(["contact", "company"]),
  customFieldDefinitions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        label: z.string(),
        fieldType: z.string(),
      })
    )
    .optional(),
});

/**
 * POST /api/gatekeeper/map-fields
 * AI-powered CSV field mapping with category tagging.
 * Falls back to alias-based mapping if OpenRouter is unavailable.
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = await request.json();
    const parsed = mapFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { headers, sampleRows, entityType, customFieldDefinitions } = parsed.data;
    const isContact = entityType === "contact";

    // Build CRM field definitions with group info
    const baseFields = isContact ? CONTACT_IMPORT_FIELDS : COMPANY_IMPORT_FIELDS;
    const crmFields = baseFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.customFieldType || "text",
      group: f.group,
    }));

    const customFields = customFieldDefinitions
      ? customFieldsToImportFields(
          customFieldDefinitions.map((d) => ({
            id: d.id,
            name: d.name,
            label: d.label,
            fieldType: d.fieldType as "text",
            entityType: entityType,
          }))
        ).map((f) => ({
          key: f.key,
          label: f.label,
          type: f.customFieldType || "text",
        }))
      : [];

    // Try AI mapping first, fall back to alias-based
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const result = await mapFields({
          headers,
          sampleRows: sampleRows.slice(0, 2),
          entityType,
          crmFields,
          customFields,
        });

        return NextResponse.json({
          mappings: result.mappings,
          method: "ai",
          tokensUsed: result.tokensUsed,
          model: result.model,
        });
      } catch (error) {
        console.error("AI field mapping failed, falling back to alias-based:", error);
      }
    }

    // Fallback: alias-based mapping with category inference
    const allFields = [...baseFields, ...customFieldsToImportFields(
      (customFieldDefinitions || []).map((d) => ({
        id: d.id,
        name: d.name,
        label: d.label,
        fieldType: d.fieldType as "text",
        entityType: entityType,
      }))
    )];
    const aliasMapping = autoMapColumnsForFields(headers, allFields);

    // Build a lookup for field group
    const fieldGroupMap = new Map<string, "contact" | "company">();
    for (const f of allFields) {
      if (f.group) fieldGroupMap.set(f.key, f.group);
    }

    const mappings = headers.map((header) => {
      const crmField = aliasMapping[header] || null;
      const category = crmField
        ? (fieldGroupMap.get(crmField) || "contact")
        : "skip";

      return {
        csvHeader: header,
        category: category as "contact" | "company" | "skip",
        crmField,
        confidence: crmField ? 80 : 0,
        reason: crmField ? "Matched by alias/keyword" : "No alias match found",
      };
    });

    return NextResponse.json({
      mappings,
      method: "alias",
      tokensUsed: 0,
      model: "none",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/gatekeeper/map-fields error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
