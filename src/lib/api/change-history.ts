import { db } from "@/lib/db";
import { changeHistory, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Records field-level changes by diffing old and new values.
 */
export async function recordFieldChanges(
  entityType: string,
  entityId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  userId: string
) {
  const changes: {
    entityType: string;
    entityId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    userId: string;
  }[] = [];

  // Only track certain fields (skip internal ones like updatedAt)
  const SKIP_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

  for (const [key, newVal] of Object.entries(newValues)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (newVal === undefined) continue;

    const oldVal = oldValues[key];
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);

    if (oldStr !== newStr) {
      changes.push({
        entityType,
        entityId,
        fieldName: key,
        oldValue: oldStr,
        newValue: newStr,
        userId,
      });
    }
  }

  if (changes.length > 0) {
    try {
      await db.insert(changeHistory).values(changes);
    } catch (error) {
      console.error("Change history write failed:", error);
    }
  }

  return changes.length;
}

/**
 * Get change history for an entity.
 */
export async function getChangeHistory(entityType: string, entityId: string) {
  return db
    .select({
      id: changeHistory.id,
      fieldName: changeHistory.fieldName,
      oldValue: changeHistory.oldValue,
      newValue: changeHistory.newValue,
      userId: changeHistory.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      changedAt: changeHistory.changedAt,
    })
    .from(changeHistory)
    .leftJoin(users, eq(changeHistory.userId, users.id))
    .where(
      and(
        eq(changeHistory.entityType, entityType),
        eq(changeHistory.entityId, entityId)
      )
    )
    .orderBy(desc(changeHistory.changedAt));
}
