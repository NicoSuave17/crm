import { db } from "@/lib/db";
import { customFieldDefinitions, customFieldValues } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export interface CreateFieldDefInput {
  entityType: "contact" | "deal" | "company";
  name: string;
  label: string;
  fieldType: "text" | "number" | "date" | "boolean" | "select" | "multi_select" | "url" | "email" | "currency";
  options?: { value: string; label: string; color?: string }[];
  isRequired?: boolean;
  position?: number;
  isVisibleInList?: boolean;
}

export async function listFieldDefinitions(entityType?: string) {
  const conditions = entityType
    ? [eq(customFieldDefinitions.entityType, entityType as "contact" | "deal" | "company")]
    : [];

  return db
    .select()
    .from(customFieldDefinitions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(customFieldDefinitions.position), asc(customFieldDefinitions.createdAt));
}

export async function createFieldDefinition(input: CreateFieldDefInput) {
  const [field] = await db
    .insert(customFieldDefinitions)
    .values(input)
    .returning();
  return field;
}

export async function updateFieldDefinition(id: string, data: Partial<CreateFieldDefInput>) {
  const [field] = await db
    .update(customFieldDefinitions)
    .set(data)
    .where(eq(customFieldDefinitions.id, id))
    .returning();
  return field;
}

export async function deleteFieldDefinition(id: string) {
  await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));
}

export async function getFieldValues(entityId: string) {
  return db
    .select({
      id: customFieldValues.id,
      fieldDefinitionId: customFieldValues.fieldDefinitionId,
      textValue: customFieldValues.textValue,
      numberValue: customFieldValues.numberValue,
      dateValue: customFieldValues.dateValue,
      booleanValue: customFieldValues.booleanValue,
      fieldName: customFieldDefinitions.name,
      fieldLabel: customFieldDefinitions.label,
      fieldType: customFieldDefinitions.fieldType,
      options: customFieldDefinitions.options,
    })
    .from(customFieldValues)
    .innerJoin(
      customFieldDefinitions,
      eq(customFieldValues.fieldDefinitionId, customFieldDefinitions.id)
    )
    .where(eq(customFieldValues.entityId, entityId));
}

export async function setFieldValue(
  fieldDefinitionId: string,
  entityId: string,
  value: { textValue?: string; numberValue?: string; dateValue?: Date; booleanValue?: boolean }
) {
  const existing = await db
    .select()
    .from(customFieldValues)
    .where(
      and(
        eq(customFieldValues.fieldDefinitionId, fieldDefinitionId),
        eq(customFieldValues.entityId, entityId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(customFieldValues)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(customFieldValues.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(customFieldValues)
    .values({ fieldDefinitionId, entityId, ...value })
    .returning();
  return created;
}

export async function deleteFieldValue(fieldDefinitionId: string, entityId: string) {
  await db
    .delete(customFieldValues)
    .where(
      and(
        eq(customFieldValues.fieldDefinitionId, fieldDefinitionId),
        eq(customFieldValues.entityId, entityId)
      )
    );
}
