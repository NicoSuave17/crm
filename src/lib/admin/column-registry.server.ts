import { db } from "@/lib/db";
import { customFieldDefinitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type ColumnDef, getBuiltInColumns } from "./column-registry";

function mapFieldType(fieldType: string): ColumnDef["type"] {
  switch (fieldType) {
    case "number":
    case "currency":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "boolean";
    case "select":
    case "multi_select":
      return "enum";
    default:
      return "text";
  }
}

/**
 * Returns all available columns for an entity type, including custom fields.
 * Server-only — requires database access.
 */
export async function getColumnsForEntity(entityType: string): Promise<ColumnDef[]> {
  const builtIn = getBuiltInColumns(entityType);

  const entityTypeMap: Record<string, "contact" | "deal" | "company"> = {
    contact: "contact",
    deal: "deal",
    company: "company",
  };

  const mappedType = entityTypeMap[entityType];
  if (!mappedType) return builtIn;

  const customFields = await db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, mappedType));

  const customColumns: ColumnDef[] = customFields.map((field) => ({
    key: `cf_${field.name}`,
    label: field.label,
    type: mapFieldType(field.fieldType),
    sortable: false,
    filterable: field.fieldType === "select" || field.fieldType === "boolean",
    defaultWidth: 140,
    isCustomField: true,
    enumValues: field.options?.map((o) => o.value),
  }));

  return [...builtIn, ...customColumns];
}
